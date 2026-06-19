// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockLeaderboard {
    mapping(address => uint256) public scores;

    // Mock updateLeaderboard with no authorization checks for testing
    function updateLeaderboard(address user, uint256 points) external {
        scores[user] += points;
    }
}