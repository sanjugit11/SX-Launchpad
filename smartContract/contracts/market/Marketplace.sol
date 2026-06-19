// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ILaunchpadCore {
    function splitAndTransferVestingSchedule(address from, address to, uint256 purchaseId, uint256 amount) external returns (uint256);
    function transferVestingSchedule(address from, address to, uint256 purchaseId) external;
}

contract Marketplace is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    ILaunchpadCore public launchpadCore;
    IERC20 public paymentToken;

    struct Listing {
        address seller;
        uint256 scheduleIndex;
        uint256 amount;
        uint256 price;
        bool isActive;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;

    event TokensListed(uint256 indexed listingId, address indexed seller, uint256 amount, uint256 price);
    event TokensCancelled(uint256 indexed listingId);
    event TokensPurchased(uint256 indexed listingId, address indexed buyer, uint256 amount);

    constructor(address _launchpadCore, address _paymentToken) Ownable(msg.sender) {
        launchpadCore = ILaunchpadCore(_launchpadCore);
        paymentToken = IERC20(_paymentToken);
    }

    function listTokens(uint256 purchaseId, uint256 amount, uint256 price) external {
        require(price > 0, "Price must be > 0");
        require(amount > 0, "Amount must be > 0");
        
        // Transfer partial vesting schedule to marketplace (escrow)
        // This will deduct from user's schedule and create a new escrowed schedule
        uint256 newPurchaseId = launchpadCore.splitAndTransferVestingSchedule(msg.sender, address(this), purchaseId, amount);

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            scheduleIndex: newPurchaseId,
            amount: amount,
            price: price,
            isActive: true
        });

        emit TokensListed(listingId, msg.sender, amount, price);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing inactive");
        require(listing.seller == msg.sender, "Not seller");

        listing.isActive = false;
        launchpadCore.transferVestingSchedule(address(this), msg.sender, listing.scheduleIndex);

        emit TokensCancelled(listingId);
    }

    function buyListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing inactive");

        listing.isActive = false;

        // Payment logic with 1% PTF
        uint256 ptf = (listing.price * 100) / 10000; // 1%
        uint256 sellerProceeds = listing.price - ptf;

        paymentToken.safeTransferFrom(msg.sender, listing.seller, sellerProceeds);
        if (ptf > 0) {
            paymentToken.safeTransferFrom(msg.sender, owner(), ptf); // Send fee to contract owner/treasury
        }

        // Transfer vesting schedule to buyer
        launchpadCore.transferVestingSchedule(address(this), msg.sender, listing.scheduleIndex);

        emit TokensPurchased(listingId, msg.sender, listing.amount);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
