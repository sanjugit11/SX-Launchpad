// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DMSVerifier.sol";

contract DIGMonitor is Ownable {
    DMSVerifier public dmsVerifier;

    address[3] public admins;
    mapping(address => bool) public isAdmin;

    bool public isKilled;
    bool public isPaused;

    struct Proposal {
        uint256 id;
        address target;
        bytes data;
        uint8 approvalCount;
        bool executed;
        mapping(address => bool) approvals;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public nextProposalId;

    event KillSwitchActivated(address indexed admin);
    event KillSwitchDeactivated(address indexed admin);
    event Paused();
    event Unpaused();
    event ProposalCreated(uint256 indexed id, address target, bytes data);
    event ProposalApproved(uint256 indexed id, address indexed admin, uint8 approvalCount);
    event ProposalExecuted(uint256 indexed id);

    constructor(address _dmsVerifier, address _admin1, address _admin2, address _admin3) Ownable(msg.sender) {
        dmsVerifier = DMSVerifier(_dmsVerifier);
        admins[0] = _admin1;
        admins[1] = _admin2;
        admins[2] = _admin3;
        isAdmin[_admin1] = true;
        isAdmin[_admin2] = true;
        isAdmin[_admin3] = true;
    }

    modifier onlyAdmins() {
        require(isAdmin[msg.sender], "Not an admin");
        _;
    }

    modifier notKilled() {
        require(!isKilled, "System is killed");
        _;
    }

    // Emergency Controls (Kill Switch bypasses multisig for rapid response)
    function activateKillSwitch() external onlyAdmins {
        isKilled = true;
        isPaused = true;
        emit KillSwitchActivated(msg.sender);
    }

    // Requires multisig to deactivate
    function deactivateKillSwitch() external {
        require(msg.sender == address(this), "Must be executed via proposal");
        isKilled = false;
        isPaused = false;
        emit KillSwitchDeactivated(tx.origin);
    }

    function createProposal(address target, bytes memory data) external onlyAdmins returns (uint256) {
        uint256 id = nextProposalId++;
        Proposal storage p = proposals[id];
        p.id = id;
        p.target = target;
        p.data = data;
        
        emit ProposalCreated(id, target, data);
        return id;
    }

    function approveProposal(uint256 proposalId, bytes32 deviceHash, bytes memory dpopSignature) external onlyAdmins notKilled {
        require(dmsVerifier.validateDPoP(msg.sender, deviceHash, dpopSignature), "Invalid device authentication");
        
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(!p.approvals[msg.sender], "Already approved");

        p.approvals[msg.sender] = true;
        p.approvalCount += 1;

        emit ProposalApproved(proposalId, msg.sender, p.approvalCount);

        if (p.approvalCount == 3) {
            executeProposal(proposalId);
        }
    }

    function executeProposal(uint256 proposalId) internal {
        Proposal storage p = proposals[proposalId];
        require(p.approvalCount == 3, "Requires 3-of-3");
        require(!p.executed, "Already executed");

        p.executed = true;

        (bool success, ) = p.target.call(p.data);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }
}
