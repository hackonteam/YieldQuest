import { useState, useEffect, useCallback } from "react";
import { Contract, parseUnits, formatUnits } from "ethers";
import { useWallet } from "./useWallet";
import { CONTRACTS, TOKEN_DECIMALS, BADGE_TYPES } from "@/lib/contracts";

// Import ABIs
import XP_MANAGER_ABI from "@/lib/abi/XPManager.json";
import BADGE_NFT_ABI from "@/lib/abi/BadgeNFT.json";
import QUEST_VAULT_ABI from "@/lib/abi/QuestVault.json";
import TEST_USDC_ABI from "@/lib/abi/TestUSDC.json";
import LEADERBOARD_ABI from "@/lib/abi/LeaderboardSnapshot.json";

export interface UserStats {
  xp: bigint;
  level: number;
  xpToNextLevel: bigint;
  currentLevelXp: bigint;
  badgeCount: number;
  badges: number[]; // Badge type IDs owned by user
  vaultShares: bigint;
  depositedAssets: bigint;
  pendingYield: bigint; // Realized yield available to claim
  usdcBalance: bigint;
  hasDeposit: boolean;
}

export interface LeaderboardEntry {
  user: string;
  xp: bigint;
  rank: number;
}

const DEFAULT_STATS: UserStats = {
  xp: 0n,
  level: 1,
  xpToNextLevel: 100n,
  currentLevelXp: 0n,
  badgeCount: 0,
  badges: [],
  vaultShares: 0n,
  depositedAssets: 0n,
  pendingYield: 0n,
  usdcBalance: 0n,
  hasDeposit: false,
};

export function useContracts() {
  const { signer, address, isConnected, isCorrectChain } = useWallet();
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(false);

  const getContracts = useCallback(() => {
    if (!signer) return null;
    
    return {
      xpManager: new Contract(CONTRACTS.XP_MANAGER, XP_MANAGER_ABI, signer),
      badgeNft: new Contract(CONTRACTS.BADGE_NFT, BADGE_NFT_ABI, signer),
      questVault: new Contract(CONTRACTS.QUEST_VAULT, QUEST_VAULT_ABI, signer),
      testUsdc: new Contract(CONTRACTS.TEST_USDC, TEST_USDC_ABI, signer),
      leaderboard: new Contract(CONTRACTS.LEADERBOARD_SNAPSHOT, LEADERBOARD_ABI, signer),
    };
  }, [signer]);

  const fetchStats = useCallback(async () => {
    if (!address || !isCorrectChain) {
      setStats(DEFAULT_STATS);
      return;
    }

    const contracts = getContracts();
    if (!contracts) return;

    setIsLoading(true);
    
    try {
      // Fetch core stats in parallel
      const [
        xp,
        level,
        badgeCount,
        vaultShares,
        usdcBalance,
      ] = await Promise.all([
        contracts.xpManager.userXP(address).catch(() => 0n),
        contracts.xpManager.userLevel(address).catch(() => 1n),
        contracts.badgeNft.balanceOf(address).catch(() => 0n),
        contracts.questVault.balanceOf(address).catch(() => 0n),
        contracts.testUsdc.balanceOf(address).catch(() => 0n),
      ]);

      // Get deposited assets (convert shares to assets) and pending yield
      let depositedAssets = 0n;
      let pendingYield = 0n;
      
      if (vaultShares > 0n) {
        try {
          depositedAssets = await contracts.questVault.convertToAssets(vaultShares);
        } catch {
          depositedAssets = vaultShares; // Fallback: 1:1 ratio
        }
        
        // Read pending yield from contract: getUserYield(address)
        try {
          pendingYield = await contracts.questVault.getUserYield(address);
        } catch {
          pendingYield = 0n;
        }
      }

      // Get user badges
      const badges: number[] = [];
      const badgeCountNum = Number(badgeCount);
      if (badgeCountNum > 0) {
        // Check which badge types the user has
        for (const [, badgeType] of Object.entries(BADGE_TYPES)) {
          try {
            const hasBadge = await contracts.badgeNft.hasBadge(address, badgeType);
            if (hasBadge) {
              badges.push(badgeType);
            }
          } catch {
            // Badge check failed, skip
          }
        }
      }

      // Get level thresholds for XP progress calculation
      const currentLevel = Number(level);
      let xpToNextLevel: bigint = 100n * BigInt(10 ** 18); // Default with PRECISION
      let currentLevelXp: bigint = 0n;
      
      try {
        const nextLevelIndex = currentLevel; // Level N needs threshold at index N
        const currentThreshold = currentLevel > 1 
          ? await contracts.xpManager.levelThresholds(currentLevel - 1)
          : 0n;
        const nextThreshold = await contracts.xpManager.levelThresholds(nextLevelIndex);
        
        xpToNextLevel = BigInt(nextThreshold.toString()) - BigInt(currentThreshold.toString());
        currentLevelXp = BigInt(xp.toString()) - BigInt(currentThreshold.toString());
        
        // Clamp to non-negative
        if (currentLevelXp < 0n) currentLevelXp = 0n;
      } catch {
        // Use defaults if thresholds not available
      }

      setStats({
        xp: BigInt(xp.toString()),
        level: currentLevel || 1,
        xpToNextLevel,
        currentLevelXp,
        badgeCount: badgeCountNum,
        badges,
        vaultShares: BigInt(vaultShares.toString()),
        depositedAssets: BigInt(depositedAssets.toString()),
        pendingYield: BigInt(pendingYield.toString()),
        usdcBalance: BigInt(usdcBalance.toString()),
        hasDeposit: BigInt(vaultShares.toString()) > 0n,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address, isCorrectChain, getContracts]);

  // Deposit TestUSDC into QuestVault
  const deposit = useCallback(async (amount: string) => {
    const contracts = getContracts();
    if (!contracts || !address) throw new Error("Not connected");

    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    
    // Check allowance and approve if needed
    const allowance = await contracts.testUsdc.allowance(address, CONTRACTS.QUEST_VAULT);
    if (allowance < amountWei) {
      const approveTx = await contracts.testUsdc.approve(CONTRACTS.QUEST_VAULT, amountWei);
      await approveTx.wait();
    }

    const tx = await contracts.questVault.deposit(amountWei, address);
    await tx.wait();
    await fetchStats();
  }, [getContracts, address, fetchStats]);

  // Withdraw from QuestVault
  const withdraw = useCallback(async (amount: string) => {
    const contracts = getContracts();
    if (!contracts || !address) throw new Error("Not connected");

    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    const tx = await contracts.questVault.withdraw(amountWei, address, address);
    await tx.wait();
    await fetchStats();
  }, [getContracts, address, fetchStats]);

  // Claim yield and receive XP
  const claimYield = useCallback(async () => {
    const contracts = getContracts();
    if (!contracts) throw new Error("Not connected");

    const tx = await contracts.questVault.claimYield();
    await tx.wait();
    await fetchStats();
  }, [getContracts, fetchStats]);

  // Fetch leaderboard snapshot
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    const contracts = getContracts();
    if (!contracts) return [];

    try {
      const snapshotCount = await contracts.leaderboard.snapshotCount();
      if (snapshotCount === 0n) return [];

      const latestId = snapshotCount;
      const snapshot = await contracts.leaderboard.getSnapshot(latestId);
      
      // snapshot.entries is an array of {user, xp, rank}
      return snapshot.entries.map((entry: { user: string; xp: bigint; rank: bigint }) => ({
        user: entry.user,
        xp: BigInt(entry.xp.toString()),
        rank: Number(entry.rank),
      }));
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      return [];
    }
  }, [getContracts]);

  // Fetch stats on connection
  useEffect(() => {
    if (isConnected && isCorrectChain) {
      fetchStats();
    }
  }, [isConnected, isCorrectChain, fetchStats]);

  return {
    stats,
    isLoading,
    fetchStats,
    deposit,
    withdraw,
    claimYield,
    fetchLeaderboard,
    // Formatting helpers for 18-decimal TestUSDC
    formatUsdc: (value: bigint) => formatUnits(value, TOKEN_DECIMALS),
    formatXp: (value: bigint) => {
      // XP uses PRECISION (1e18), display as whole number
      const formatted = formatUnits(value, 18);
      return parseFloat(formatted).toFixed(0);
    },
  };
}
