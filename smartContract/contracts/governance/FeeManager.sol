// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract FeeManager is Ownable {

    mapping(bytes32 => uint256) public feesBps;
    mapping(bytes32 => address) public feeRecipients;

    event FeeUpdated(bytes32 indexed feeType, uint256 newFeeBps);
    event FeeRecipientUpdated(bytes32 indexed feeType, address newRecipient);

    constructor() Ownable(msg.sender) {}

    function setFee(bytes32 feeType, uint256 feeBps) external onlyOwner {
        require(feeBps <= 10000, "Fee too high");
        feesBps[feeType] = feeBps;
        emit FeeUpdated(feeType, feeBps);
    }

    function setFeeRecipient(bytes32 feeType, address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid address");
        feeRecipients[feeType] = recipient;
        emit FeeRecipientUpdated(feeType, recipient);
    }

    function getFeeInfo(bytes32 feeType) external view returns (uint256, address) {
        return (feesBps[feeType], feeRecipients[feeType]);
    }
}
