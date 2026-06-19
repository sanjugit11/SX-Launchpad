// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SXP.sol";

contract SXUA is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    SXP public sxpToken;

    address public sxmmAddress;
    address public ptfFeeAddress;
    address public withdrawalFeeAddress;

    uint256 public constant LOCK_DURATION = 100 days;
    uint256 public constant DAILY_YIELD_BPS = 12; // 0.12% = 12 bps
    uint256 public constant EARLY_WITHDRAWAL_PENALTY_BPS = 1000; // 10%
    uint256 public withdrawalFeeBps = 50; // 0.5%
    uint256 public ptfFeeBps = 50; // 0.5%

    mapping(address => bool) public supportedStables;
    mapping(address => uint8) public stableDecimals;

    struct SubAccount {
        uint256 id;
        uint256 committedAmount;
        uint256 uncommittedAmount;
        uint256 depositTime;
        uint256 lastYieldAccrual;
        address depositToken;
    }

    mapping(address => SubAccount[]) public userSubAccounts;
    uint256 private nextSubAccountId = 1;

    event Deposited(address indexed user, uint256 subAccountId, uint256 amount, address token);
    event Withdrawn(address indexed user, uint256 subAccountId, uint256 amount);
    event YieldAccrued(address indexed user, uint256 subAccountId, uint256 yieldAmount);
    event PenaltyApplied(address indexed user, uint256 subAccountId, uint256 penaltyAmount);
    event PTFCollected(address indexed user, uint256 amount);

    constructor(
        address _sxpToken,
        address _sxmmAddress,
        address _ptfFeeAddress,
        address _withdrawalFeeAddress
    ) Ownable(msg.sender) {
        sxpToken = SXP(_sxpToken);
        sxmmAddress = _sxmmAddress;
        ptfFeeAddress = _ptfFeeAddress;
        withdrawalFeeAddress = _withdrawalFeeAddress;
    }

    function addSupportedStable(address token, uint8 decimals) external onlyOwner {
        supportedStables[token] = true;
        stableDecimals[token] = decimals;
    }

    function removeSupportedStable(address token) external onlyOwner {
        supportedStables[token] = false;
    }

    function depositWithSplit(
        address token,
        uint256 amount,
        uint256 committedPercent // 0 to 100
    ) external nonReentrant {
        require(supportedStables[token], "Unsupported stablecoin");
        require(amount > 0, "Amount must be > 0");
        require(committedPercent <= 100, "Invalid split percent");

        uint8 decimals = stableDecimals[token];
        uint256 normalizedAmount = decimals < 18 ? amount * (10 ** (18 - decimals)) : amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 ptfFee = (normalizedAmount * ptfFeeBps) / 10000;
        uint256 netAmount = normalizedAmount - ptfFee;

        if (ptfFee > 0) {
            uint256 ptfFeeTokenAmount = decimals < 18 ? ptfFee / (10 ** (18 - decimals)) : ptfFee;
            IERC20(token).safeTransfer(ptfFeeAddress, ptfFeeTokenAmount);
            emit PTFCollected(msg.sender, ptfFee);
        }

        sxpToken.mint(msg.sender, netAmount);

        uint256 committedAmount = (netAmount * committedPercent) / 100;
        uint256 uncommittedAmount = netAmount - committedAmount;

        uint256 subId = nextSubAccountId++;
        userSubAccounts[msg.sender].push(SubAccount({
            id: subId,
            committedAmount: committedAmount,
            uncommittedAmount: uncommittedAmount,
            depositTime: block.timestamp,
            lastYieldAccrual: block.timestamp,
            depositToken: token
        }));

        emit Deposited(msg.sender, subId, amount, token);
    }

    function depositWithSplitFor(
        address user,
        address token,
        uint256 amount,
        uint256 committedPercent // 0 to 100
    ) external nonReentrant {
        require(supportedStables[token], "Unsupported stablecoin");
        require(amount > 0, "Amount must be > 0");
        require(committedPercent <= 100, "Invalid split percent");

        uint8 decimals = stableDecimals[token];
        uint256 normalizedAmount = decimals < 18 ? amount * (10 ** (18 - decimals)) : amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 ptfFee = (normalizedAmount * ptfFeeBps) / 10000;
        uint256 netAmount = normalizedAmount - ptfFee;

        if (ptfFee > 0) {
            uint256 ptfFeeTokenAmount = decimals < 18 ? ptfFee / (10 ** (18 - decimals)) : ptfFee;
            IERC20(token).safeTransfer(ptfFeeAddress, ptfFeeTokenAmount);
            emit PTFCollected(user, ptfFee);
        }

        sxpToken.mint(user, netAmount);

        uint256 committedAmount = (netAmount * committedPercent) / 100;
        uint256 uncommittedAmount = netAmount - committedAmount;

        uint256 subId = nextSubAccountId++;
        userSubAccounts[user].push(SubAccount({
            id: subId,
            committedAmount: committedAmount,
            uncommittedAmount: uncommittedAmount,
            depositTime: block.timestamp,
            lastYieldAccrual: block.timestamp,
            depositToken: token
        }));

        emit Deposited(user, subId, amount, token);
    }

    function accrueYield(uint256 subAccountIndex) public {
        require(subAccountIndex < userSubAccounts[msg.sender].length, "Index out of bounds");
        SubAccount storage subAcc = userSubAccounts[msg.sender][subAccountIndex];

        uint256 daysElapsed = (block.timestamp - subAcc.lastYieldAccrual) / 1 days;
        if (daysElapsed > 0 && subAcc.committedAmount > 0) {
            uint256 yieldAmount = (subAcc.committedAmount * DAILY_YIELD_BPS * daysElapsed) / 10000;
            subAcc.lastYieldAccrual += daysElapsed * 1 days;
            sxpToken.mint(msg.sender, yieldAmount);
            emit YieldAccrued(msg.sender, subAcc.id, yieldAmount);
        }
    }

    function withdraw(uint256 subAccountIndex, uint256 amountNormalized) external nonReentrant {
        require(subAccountIndex < userSubAccounts[msg.sender].length, "Index out of bounds");
        SubAccount storage subAcc = userSubAccounts[msg.sender][subAccountIndex];
        
        accrueYield(subAccountIndex);

        require(amountNormalized <= subAcc.committedAmount + subAcc.uncommittedAmount, "Insufficient balance");

        uint256 penalty = 0;

        if (amountNormalized > subAcc.uncommittedAmount) {
            uint256 fromCommitted = amountNormalized - subAcc.uncommittedAmount;
            subAcc.uncommittedAmount = 0;
            subAcc.committedAmount -= fromCommitted;

            if (block.timestamp < subAcc.depositTime + LOCK_DURATION) {
                penalty = (fromCommitted * EARLY_WITHDRAWAL_PENALTY_BPS) / 10000;
                emit PenaltyApplied(msg.sender, subAcc.id, penalty);
            }
        } else {
            subAcc.uncommittedAmount -= amountNormalized;
        }

        uint256 fee = (amountNormalized * withdrawalFeeBps) / 10000;
        uint256 netWithdrawalNormalized = amountNormalized - penalty - fee;

        uint8 decimals = stableDecimals[subAcc.depositToken];
        uint256 netTokenAmount = decimals < 18 ? netWithdrawalNormalized / (10 ** (18 - decimals)) : netWithdrawalNormalized;
        uint256 penaltyTokenAmount = decimals < 18 ? penalty / (10 ** (18 - decimals)) : penalty;
        uint256 feeTokenAmount = decimals < 18 ? fee / (10 ** (18 - decimals)) : fee;

        if (penaltyTokenAmount > 0) {
            IERC20(subAcc.depositToken).safeTransfer(sxmmAddress, penaltyTokenAmount);
        }
        if (feeTokenAmount > 0) {
            IERC20(subAcc.depositToken).safeTransfer(withdrawalFeeAddress, feeTokenAmount);
        }

        // Must burn or pull SXP equivalent? The requirements mention 1 SXP per $1 deposited.
        // It implies SXP represents the balance. We burn SXP on withdrawal.
        // Or SXP is just minted as a reward, and the original USDC is kept in SXUA.
        // Let's assume user must have the SXP to withdraw the underlying USDC.
        IERC20(address(sxpToken)).safeTransferFrom(msg.sender, address(this), amountNormalized);

        IERC20(subAcc.depositToken).safeTransfer(msg.sender, netTokenAmount);

        emit Withdrawn(msg.sender, subAcc.id, amountNormalized);
    }

    function getBalances(address user) external view returns (uint256 totalCommitted, uint256 totalUncommitted) {
        SubAccount[] memory accounts = userSubAccounts[user];
        for (uint i = 0; i < accounts.length; i++) {
            totalCommitted += accounts[i].committedAmount;
            totalUncommitted += accounts[i].uncommittedAmount;
        }
    }

    function getSubAccounts(address user) external view returns (SubAccount[] memory) {
        return userSubAccounts[user];
    }
}
