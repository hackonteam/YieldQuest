// YieldQuest Smart Contract Configuration - Mantle Sepolia
// Per canvas-ui-spec v2: TestUSDC uses 18 decimals

export const CONTRACTS = {
  TEST_USDC: "0x2D0B0a809212253C1c2894fF2eF2b0794F3B3408",
  QUEST_VAULT: "0x9Db8974f6D22EBa82f0fEd4004b58CD8db28D76E",
  XP_MANAGER: "0x56747dEAEAa001935dEc5706D9b947904049063A",
  BADGE_NFT: "0xF143F06E43c488497254C5cEf628ADD37ea91295",
  LEADERBOARD_SNAPSHOT: "0x6Facc3CE673376F6cdae1C27f90F30e9f2B620F1",
} as const;

export const CHAIN_CONFIG = {
  chainId: 5003,
  chainName: "Mantle Sepolia Testnet",
  nativeCurrency: {
    name: "MNT",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://sepolia.mantlescan.xyz"],
};

// Token decimals - TestUSDC uses 18 decimals (NOT 6 like real USDC)
export const TOKEN_DECIMALS = 18;

// Badge type constants (uint256, matching BadgeNFT contract)
export const BADGE_TYPES = {
  EARLY_ADOPTER: 1,
  FIRST_DEPOSIT: 2,
  LEVEL_5: 3,
  LEVEL_10: 4,
  YIELD_MASTER: 5,
} as const;

export const BADGE_NAMES: Record<number, string> = {
  [BADGE_TYPES.EARLY_ADOPTER]: "Early Adopter",
  [BADGE_TYPES.FIRST_DEPOSIT]: "First Deposit",
  [BADGE_TYPES.LEVEL_5]: "Level 5 Achiever",
  [BADGE_TYPES.LEVEL_10]: "Level 10 Master",
  [BADGE_TYPES.YIELD_MASTER]: "Yield Master",
};

export const BADGE_DESCRIPTIONS: Record<number, string> = {
  [BADGE_TYPES.EARLY_ADOPTER]: "Joined YieldQuest during the early phase",
  [BADGE_TYPES.FIRST_DEPOSIT]: "Made your first deposit into the vault",
  [BADGE_TYPES.LEVEL_5]: "Reached Level 5 through yield generation",
  [BADGE_TYPES.LEVEL_10]: "Achieved Level 10 mastery",
  [BADGE_TYPES.YIELD_MASTER]: "Claimed significant yield rewards",
};
