// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Leaderboard.sol";
import "../core/SXP.sol";

contract Referral is Ownable {
    
    Leaderboard public leaderboard;
    SXP public rewardToken;
    
    uint256 public rewardAmount = 100 * 1e18; // 100 SXP tokens per successful referral

    struct ReferralStats {
        uint256 totalReferrals;
        uint256 successfulReferrals;
    }

    mapping(string => address) public codeToReferrer;
    mapping(address => string) public referrerToCode;
    mapping(address => address) public userToReferrer;
    mapping(address => ReferralStats) public stats;

    event ReferralRegistered(address indexed referrer, string code);
    event ReferralCompleted(address indexed referrer, address indexed user, uint256 reward);

    constructor(address _leaderboard, address _rewardToken) Ownable(msg.sender) {
        leaderboard = Leaderboard(_leaderboard);
        rewardToken = SXP(_rewardToken);
    }

    function createReferral(string memory code) external {
        require(bytes(code).length > 0, "Code cannot be empty");
        require(codeToReferrer[code] == address(0), "Code already exists");
        require(bytes(referrerToCode[msg.sender]).length == 0, "Referrer already has a code");

        codeToReferrer[code] = msg.sender;
        referrerToCode[msg.sender] = code;

        emit ReferralRegistered(msg.sender, code);
    }

    function completeReferral(string memory code) external {
        address referrer = codeToReferrer[code];
        
        require(referrer != address(0), "Invalid referral code");
        require(referrer != msg.sender, "Self-referral protection");
        require(userToReferrer[msg.sender] == address(0), "Duplicate protection: already referred");

        userToReferrer[msg.sender] = referrer;
        stats[referrer].totalReferrals += 1;
        stats[referrer].successfulReferrals += 1;

        // Reward minting to both referrer and referee
        rewardToken.mint(referrer, rewardAmount);
        rewardToken.mint(msg.sender, rewardAmount);

        // Update leaderboard
        leaderboard.updateLeaderboard(referrer, 1);

        emit ReferralCompleted(referrer, msg.sender, rewardAmount);
    }

    function getReferralStats(address referrer) external view returns (ReferralStats memory) {
        return stats[referrer];
    }
}
