export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export const SXUA_ABI = [
  "function depositWithSplit(address token, uint256 amount, uint256 committedPercent) external",
  "function depositWithSplitFor(address user, address token, uint256 amount, uint256 committedPercent) external",
  "function withdraw(uint256 subAccountIndex, uint256 amountNormalized) external",
  "function getBalances(address user) external view returns (uint256 totalCommitted, uint256 totalUncommitted)",
  "function getSubAccounts(address user) external view returns (tuple(uint256 id, uint256 committedAmount, uint256 uncommittedAmount, uint256 depositTime, uint256 lastYieldAccrual, address depositToken)[])"
];

export const BUY_STABLES_PORTAL_ABI = [
  "function buyStables(uint256 minUsdcOut, uint256 committedPercent) external payable",
  "function getQuote(uint256 ethAmount) external view returns (uint256)"
];
