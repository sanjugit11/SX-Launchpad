// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SXP is ERC20, Ownable {
    mapping(address => bool) public isMinter;

    event MinterStatusChanged(address indexed minter, bool status);

    constructor() ERC20("SXP Token", "SXP") Ownable(msg.sender) {
        isMinter[msg.sender] = true;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender] || msg.sender == owner(), "Not a minter");
        _;
    }

    function setMinter(address minter, bool status) external onlyOwner {
        isMinter[minter] = status;
        emit MinterStatusChanged(minter, status);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
