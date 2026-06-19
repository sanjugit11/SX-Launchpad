// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Leaderboard is Ownable {

    struct ReferrerScore {
        address referrer;
        uint256 score;
    }

    ReferrerScore[] public topReferrers;
    uint256 public maxLeaderboardSize = 100;
    mapping(address => uint256) public referrerScores;
    
    // Whitelist for contracts allowed to update leaderboard
    mapping(address => bool) public updaters;

    event LeaderboardUpdated(address indexed referrer, uint256 newScore);

    constructor() Ownable(msg.sender) {}

    function setUpdater(address updater, bool status) external onlyOwner {
        updaters[updater] = status;
    }

    function updateLeaderboard(address referrer, uint256 scoreIncrement) external {
        require(updaters[msg.sender] || msg.sender == owner(), "Not authorized");
        
        referrerScores[referrer] += scoreIncrement;
        uint256 newScore = referrerScores[referrer];

        _updateTopReferrers(referrer, newScore);

        emit LeaderboardUpdated(referrer, newScore);
    }

    function _updateTopReferrers(address referrer, uint256 newScore) internal {
        bool found = false;
        for (uint256 i = 0; i < topReferrers.length; i++) {
            if (topReferrers[i].referrer == referrer) {
                topReferrers[i].score = newScore;
                found = true;
                break;
            }
        }

        if (!found) {
            topReferrers.push(ReferrerScore({
                referrer: referrer,
                score: newScore
            }));
        }

        // Sort the leaderboard (simple bubble sort for small arrays)
        for (uint256 i = 0; i < topReferrers.length; i++) {
            for (uint256 j = i + 1; j < topReferrers.length; j++) {
                if (topReferrers[i].score < topReferrers[j].score) {
                    ReferrerScore memory temp = topReferrers[i];
                    topReferrers[i] = topReferrers[j];
                    topReferrers[j] = temp;
                }
            }
        }

        // Trim
        if (topReferrers.length > maxLeaderboardSize) {
            topReferrers.pop();
        }
    }

    function getTopReferrers() external view returns (ReferrerScore[] memory) {
        return topReferrers;
    }
}
