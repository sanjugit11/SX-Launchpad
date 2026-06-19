// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LaunchpadCore is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public paymentToken; // e.g. USDC
    IERC20 public ltToken; // Launchpad Token
    IERC20 public mpToken; // MP Token

    uint256 public constant CLIFF_DURATION = 30 days;
    uint256 public constant VESTING_DURATION = 180 days;
    uint256 public constant MINT_FEE_BPS = 200; // 2%

    uint256 public tokenPrice; // Price of 1 LT in paymentToken
    address public treasury;
    address public marketplaceAddress;
    
    uint256 public purchaseCounter = 0;

    struct PurchaseRecord {
        address user;
        uint256 amountLT;
        uint256 claimedAmount;
        uint256 purchaseTime;
        uint256 cliffEnd;
        uint256 vestingEnd;
        uint256 phase;
        bool isActive;
    }
    mapping(uint256 => PurchaseRecord) public purchases;
    mapping(address => uint256[]) public userPurchases;

    event TokensPurchased(uint256 indexed purchaseId, address indexed user, uint256 amount);
    event VestedTokensClaimed(uint256 indexed purchaseId, address indexed user, uint256 amount);
    event TokensConvertedToMP(address indexed user, uint256 amount);
    event ForfeitureExecuted(uint256 indexed purchaseId, address indexed user, uint256 forfeitedAmount);
    event MintingCostPaid(uint256 indexed purchaseId, address indexed user, uint256 feeAmount);

    constructor(
        address _paymentToken,
        address _ltToken,
        address _mpToken,
        address _treasury,
        uint256 _tokenPrice
    ) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        ltToken = IERC20(_ltToken);
        mpToken = IERC20(_mpToken);
        treasury = _treasury;
        tokenPrice = _tokenPrice;
    }

    function purchaseTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // The exact conversion logic: 1 LT = 1 USDC in the frontend.
        // Assuming USDC is 6 decimals and LT is 18 decimals.
        // But if frontend sends amount as 1000e6, and we want 1000 LT (1000e18),
        // we transfer 1000e6 USDC from user.
        paymentToken.safeTransferFrom(msg.sender, treasury, amount);
        
        // Since testnet mock USDC has 18 decimals, 1 USDC = 1 LT directly without multiplier
        uint256 amountLT = amount; 

        purchaseCounter++;
        uint256 pId = purchaseCounter;

        purchases[pId] = PurchaseRecord({
            user: msg.sender,
            amountLT: amountLT,
            claimedAmount: 0,
            purchaseTime: block.timestamp,
            cliffEnd: block.timestamp + CLIFF_DURATION,
            vestingEnd: block.timestamp + VESTING_DURATION,
            phase: 1,
            isActive: true
        });

        userPurchases[msg.sender].push(pId);

        emit TokensPurchased(pId, msg.sender, amountLT);
    }

    function claimVested(uint256 purchaseId) external nonReentrant {
        PurchaseRecord storage schedule = purchases[purchaseId];
        require(schedule.isActive, "Schedule inactive");
        require(schedule.user == msg.sender, "Not the owner");
        require(block.timestamp >= schedule.cliffEnd, "Cliff not reached");

        // lump-sum claim only after full vesting duration
        require(block.timestamp >= schedule.vestingEnd, "Vesting not complete");
        require(schedule.claimedAmount == 0, "Already claimed");

        schedule.claimedAmount = schedule.amountLT;
        schedule.isActive = false;

        uint256 mintFee = (schedule.amountLT * MINT_FEE_BPS) / 10000;
        uint256 transferAmount = schedule.amountLT - mintFee;

        // Treasury receives mint fee
        ltToken.safeTransfer(treasury, mintFee);
        // User receives remainder
        ltToken.safeTransfer(msg.sender, transferAmount);

        emit MintingCostPaid(purchaseId, msg.sender, mintFee);
        emit VestedTokensClaimed(purchaseId, msg.sender, transferAmount);
    }

    function forfeitPurchase(uint256 purchaseId) external nonReentrant {
        PurchaseRecord storage schedule = purchases[purchaseId];
        require(schedule.isActive, "Schedule inactive");
        require(schedule.user == msg.sender, "Not the owner");
        
        uint256 forfeited = schedule.amountLT;
        schedule.isActive = false;
        schedule.amountLT = 0;

        // Transfer LT to SXMM (treasury)
        ltToken.safeTransfer(treasury, forfeited);

        emit ForfeitureExecuted(purchaseId, msg.sender, forfeited);
    }

    function convertToMP(uint256 amountLT) external nonReentrant {
        require(amountLT > 0, "Amount must be > 0");
        
        // Burn or transfer LT back to treasury
        ltToken.safeTransferFrom(msg.sender, treasury, amountLT);
        
        // 1 LT = 10 MP conversion
        uint256 mintAmountMP = amountLT * 10;
        mpToken.safeTransfer(msg.sender, mintAmountMP);

        emit TokensConvertedToMP(msg.sender, amountLT);
    }

    function getUserPurchases(address user) external view returns (uint256[] memory) {
        return userPurchases[user];
    }

    function setMarketplaceAddress(address _marketplace) external onlyOwner {
        marketplaceAddress = _marketplace;
    }

    function splitAndTransferVestingSchedule(address from, address to, uint256 purchaseId, uint256 amount) external nonReentrant returns (uint256) {
        require(msg.sender == marketplaceAddress, "Only marketplace");
        PurchaseRecord storage schedule = purchases[purchaseId];
        require(schedule.isActive, "Schedule inactive");
        require(schedule.user == from, "Not the owner");
        require(schedule.amountLT >= amount, "Amount exceeds balance");
        
        // Deduct from original schedule
        schedule.amountLT -= amount;
        if (schedule.amountLT == 0) {
            schedule.isActive = false;
        }

        // Create new schedule for 'to' (Marketplace escrow)
        purchaseCounter++;
        uint256 newId = purchaseCounter;
        purchases[newId] = PurchaseRecord({
            user: to,
            amountLT: amount,
            claimedAmount: 0,
            purchaseTime: schedule.purchaseTime,
            cliffEnd: schedule.cliffEnd,
            vestingEnd: schedule.vestingEnd,
            phase: schedule.phase,
            isActive: true
        });
        userPurchases[to].push(newId);
        
        return newId;
    }

    function transferVestingSchedule(address from, address to, uint256 purchaseId) external nonReentrant {
        require(msg.sender == marketplaceAddress, "Only marketplace");
        PurchaseRecord storage schedule = purchases[purchaseId];
        require(schedule.isActive, "Schedule inactive");
        require(schedule.user == from, "Not the owner");

        schedule.user = to;
        userPurchases[to].push(purchaseId);
    }
}
