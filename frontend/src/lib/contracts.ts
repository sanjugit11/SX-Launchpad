export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const SXUA_ABI = [
  {
    type: "function",
    name: "depositWithSplit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "committedPercent", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositWithSplitFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "committedPercent", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subAccountIndex", type: "uint256" },
      { name: "amountNormalized", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBalances",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCommitted", type: "uint256" },
      { name: "totalUncommitted", type: "uint256" },
    ],
  },
] as const;

export const BUY_STABLES_PORTAL_ABI = [
  {
    type: "function",
    name: "buyStables",
    stateMutability: "payable",
    inputs: [
      { name: "minUsdcOut", type: "uint256" },
      { name: "committedPercent", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getQuote",
    stateMutability: "view",
    inputs: [{ name: "ethAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "registerSXSE",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "status", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isSXSE",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const LAUNCHPAD_CORE_ABI = [
  {
    type: "function",
    name: "tokenPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getUserPurchases",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "purchases",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "user", type: "address" },
      { name: "amountLT", type: "uint256" },
      { name: "claimedAmount", type: "uint256" },
      { name: "purchaseTime", type: "uint256" },
      { name: "cliffEnd", type: "uint256" },
      { name: "vestingEnd", type: "uint256" },
      { name: "phase", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "purchaseTokens",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimVested",
    stateMutability: "nonpayable",
    inputs: [{ name: "purchaseId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "forfeitPurchase",
    stateMutability: "nonpayable",
    inputs: [{ name: "purchaseId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "convertToMP",
    stateMutability: "nonpayable",
    inputs: [{ name: "amountLT", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "TokensPurchased",
    inputs: [
      { name: "purchaseId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VestedTokensClaimed",
    inputs: [
      { name: "purchaseId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MintingCostPaid",
    inputs: [
      { name: "purchaseId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "feeAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ForfeitureExecuted",
    inputs: [
      { name: "purchaseId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "forfeitedAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensConvertedToMP",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "listTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "purchaseId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "price", type: "uint256" }
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: []
  }
] as const;

export const REFERRAL_ABI = [
  {
    type: "function",
    name: "createReferral",
    stateMutability: "nonpayable",
    inputs: [{ name: "code", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "completeReferral",
    stateMutability: "nonpayable",
    inputs: [{ name: "code", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "referrerToCode",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "codeToReferrer",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "userToReferrer",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "rewardAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReferralStats",
    stateMutability: "view",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { name: "totalReferrals", type: "uint256" },
          { name: "successfulReferrals", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const DIG_MONITOR_ABI = [
  {
    type: "function",
    name: "createProposal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approveProposal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "deviceHash", type: "bytes32" },
      { name: "dpopSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "activateKillSwitch",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "deactivateKillSwitch",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getProposal",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "approvalCount", type: "uint8" },
      { name: "executed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "hasAdminApproved",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "admin", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "proposals",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "approvalCount", type: "uint8" },
      { name: "executed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "nextProposalId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isKilled",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isPaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getKillSwitchStatus",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "", type: "bool" },
      { name: "", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "KillSwitchActivated",
    inputs: [
      { name: "admin", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "KillSwitchDeactivated",
    inputs: [
      { name: "admin", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Paused",
    inputs: [],
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProposalExecuted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
    ],
  },
] as const;

export const DMS_VERIFIER_ABI = [
  {
    type: "function",
    name: "registerMasterDevice",
    stateMutability: "nonpayable",
    inputs: [{ name: "deviceHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "registerMasterDeviceFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "admin", type: "address" },
      { name: "deviceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deactivateDevice",
    stateMutability: "nonpayable",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "validateDPoP",
    stateMutability: "view",
    inputs: [
      { name: "admin", type: "address" },
      { name: "deviceHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "masterDevices",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "deviceHash", type: "bytes32" },
      { name: "isActive", type: "bool" },
      { name: "registrationTime", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MasterDeviceRegistered",
    inputs: [
      { name: "admin", type: "address", indexed: true },
      { name: "deviceHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeviceDeactivated",
    inputs: [
      { name: "admin", type: "address", indexed: true },
    ],
  },
] as const;
