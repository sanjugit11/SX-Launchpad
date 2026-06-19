// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DMSVerifier is Ownable {

    struct DeviceInfo {
        bytes32 deviceHash;
        bool isActive;
        uint256 registrationTime;
    }

    mapping(address => DeviceInfo) public masterDevices;

    event MasterDeviceRegistered(address indexed admin, bytes32 deviceHash);
    event DeviceDeactivated(address indexed admin);

    constructor() Ownable(msg.sender) {}

    function registerMasterDevice(bytes32 deviceHash) external {
        masterDevices[msg.sender] = DeviceInfo({
            deviceHash: deviceHash,
            isActive: true,
            registrationTime: block.timestamp
        });

        emit MasterDeviceRegistered(msg.sender, deviceHash);
    }

    function registerMasterDeviceFor(address admin, bytes32 deviceHash) external onlyOwner {
        masterDevices[admin] = DeviceInfo({
            deviceHash: deviceHash,
            isActive: true,
            registrationTime: block.timestamp
        });

        emit MasterDeviceRegistered(admin, deviceHash);
    }

    function deactivateDevice(address admin) external onlyOwner {
        masterDevices[admin].isActive = false;
        emit DeviceDeactivated(admin);
    }

    // Pseudo DPoP validation
    function validateDPoP(address admin, bytes32 deviceHash, bytes memory signature) external view returns (bool) {
        require(masterDevices[admin].isActive, "Device not active");
        require(masterDevices[admin].deviceHash == deviceHash, "Invalid device hash");
        
        // In a real implementation, we would recover the signer from the signature
        // and verify it matches the expected hardware key. 
        // For this architecture mock, we assume validation logic here:
        return true;
    }
}
