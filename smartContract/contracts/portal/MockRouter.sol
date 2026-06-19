// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRouter {
    address public weth;
    address public usdc;

    constructor(address _usdc) {
        usdc = _usdc;
        weth = address(this); // mock WETH
    }

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts)
    {
        // Just mock the swap. We will mint or transfer some mock USDC to the `to` address.
        // Assuming this MockRouter has been funded with mock USDC.
        IERC20(usdc).transfer(to, 100 * 10**18); // Send 100 USDC mock
        amounts = new uint[](2);
        amounts[0] = msg.value;
        amounts[1] = 100 * 10**18;
        return amounts;
    }

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts) {
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = 100 * 10**18;
        return amounts;
    }

    function WETH() external view returns (address) {
        return weth;
    }
}
