// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/market/Marketplace.sol";

contract MockLaunchpadCore is ILaunchpadCore {
    // Keep track of schedule owners for testing purposes
    mapping(uint256 => address) public scheduleOwners;

    // Helper to mint a schedule to a user for testing
    function mintSchedule(address to, uint256 scheduleIndex) external {
        scheduleOwners[scheduleIndex] = to;
    }

    function splitAndTransferVestingSchedule(address from, address to, uint256 purchaseId, uint256 amount) external override returns (uint256) {
        require(scheduleOwners[purchaseId] == from, "Not the schedule owner");
        
        // Mock creating a new schedule
        uint256 newPurchaseId = purchaseId + 1000;
        scheduleOwners[newPurchaseId] = to;
        return newPurchaseId;
    }

    function transferVestingSchedule(address from, address to, uint256 purchaseId) external override {
        require(scheduleOwners[purchaseId] == from, "Not the schedule owner");
        scheduleOwners[purchaseId] = to;
    }
}
