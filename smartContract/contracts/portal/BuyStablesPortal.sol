// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core/SXUA.sol";

interface ISXCP {
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function WETH() external pure returns (address);
}

contract BuyStablesPortal is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    SXUA public sxuaContract;
    ISXCP public sxcpRouter;
    IERC20 public usdcToken;
    
    address public treasury;
    uint256 public feeBps = 100; // 1%

    mapping(address => bool) public isSXSE; // SXSE Registration

    event StablesPurchased(address indexed user, uint256 ethAmount, uint256 usdcAmount);
    event SXSERegistered(address indexed user, bool status);

    constructor(
        address _sxua,
        address _sxcpRouter,
        address _usdc,
        address _treasury
    ) Ownable(msg.sender) {
        sxuaContract = SXUA(_sxua);
        sxcpRouter = ISXCP(_sxcpRouter);
        usdcToken = IERC20(_usdc);
        treasury = _treasury;

        usdcToken.forceApprove(_sxua, type(uint256).max);
    }

    function registerSXSE(address user, bool status) external onlyOwner {
        isSXSE[user] = status;
        emit SXSERegistered(user, status);
    }

    function getQuote(uint256 ethAmount) public view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = sxcpRouter.WETH();
        path[1] = address(usdcToken);
        uint[] memory amounts = sxcpRouter.getAmountsOut(ethAmount, path);
        return amounts[1];
    }

    function buyStables(uint256 minUsdcOut, uint256 committedPercent) external payable nonReentrant {
        require(isSXSE[msg.sender], "Not SXSE registered");
        require(msg.value > 0, "No ETH provided");

        address[] memory path = new address[](2);
        path[0] = sxcpRouter.WETH();
        path[1] = address(usdcToken);

        uint256 initialUsdc = usdcToken.balanceOf(address(this));

        // Swap ETH for USDC via SXCP
        sxcpRouter.swapExactETHForTokens{value: msg.value}(
            minUsdcOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 receivedUsdc = usdcToken.balanceOf(address(this)) - initialUsdc;
        
        // Fee baked into output
        uint256 fee = (receivedUsdc * feeBps) / 10000;
        uint256 netUsdc = receivedUsdc - fee;

        // Treasury transfer
        if (fee > 0) {
            usdcToken.safeTransfer(treasury, fee);
        }

        // Transfer USDC into SXUA for user
        sxuaContract.depositWithSplitFor(msg.sender, address(usdcToken), netUsdc, committedPercent);

        emit StablesPurchased(msg.sender, msg.value, netUsdc);
    }
}
