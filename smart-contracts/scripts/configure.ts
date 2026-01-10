import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  network: string;
  chainId: number;
  timestamp: string;
  testUSDC: string;
  badgeNFT: string;
  xpManager: string;
  questVault: string;
  leaderboardSnapshot: string;
}

async function main() {
  console.log("Starting YieldQuest configuration...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Configuring contracts with account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("---\n");

  // Load deployment addresses
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}-${network.chainId}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please run deploy.ts first.`);
  }

  const deploymentData: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  console.log("Loaded deployment addresses:");
  console.log("BadgeNFT:             ", deploymentData.badgeNFT);
  console.log("XPManager:            ", deploymentData.xpManager);
  console.log("QuestVault:           ", deploymentData.questVault);
  console.log("LeaderboardSnapshot:  ", deploymentData.leaderboardSnapshot);
  console.log("---\n");

  // Get contract instances
  const badgeNFT = await ethers.getContractAt("BadgeNFT", deploymentData.badgeNFT);
  const xpManager = await ethers.getContractAt("XPManager", deploymentData.xpManager);
  const questVault = await ethers.getContractAt("QuestVault", deploymentData.questVault);
  const leaderboardSnapshot = await ethers.getContractAt("LeaderboardSnapshot", deploymentData.leaderboardSnapshot);

  // Configuration Step 1: Configure XPManager.setBadgeNFT()
  console.log("1. Configuring XPManager.setBadgeNFT()...");
  const tx1 = await xpManager.setBadgeNFT(badgeNFT.address);
  await tx1.wait();
  console.log("✓ XPManager.badgeNFT set to:", badgeNFT.address);
  console.log("  Transaction hash:", tx1.hash);
  console.log("");

  // Configuration Step 2: Configure XPManager.setQuestVault()
  console.log("2. Configuring XPManager.setQuestVault()...");
  const tx2 = await xpManager.setQuestVault(questVault.address);
  await tx2.wait();
  console.log("✓ XPManager.questVault set to:", questVault.address);
  console.log("  Transaction hash:", tx2.hash);
  console.log("");

  // Configuration Step 3: Configure BadgeNFT.setXPManager()
  console.log("3. Configuring BadgeNFT.setXPManager()...");
  const tx3 = await badgeNFT.setXPManager(xpManager.address);
  await tx3.wait();
  console.log("✓ BadgeNFT.xpManager set to:", xpManager.address);
  console.log("  Transaction hash:", tx3.hash);
  console.log("");

  // Configuration Step 4: Configure QuestVault.setXPManager()
  console.log("4. Configuring QuestVault.setXPManager()...");
  const tx4 = await questVault.setXPManager(xpManager.address);
  await tx4.wait();
  console.log("✓ QuestVault.xpManager set to:", xpManager.address);
  console.log("  Transaction hash:", tx4.hash);
  console.log("");

  // Configuration Step 5: Set level thresholds
  console.log("5. Setting level thresholds...");
  const levelThresholds = [
    0,      // Level 1
    100,    // Level 2
    350,    // Level 3
    850,    // Level 4
    1850,   // Level 5
    3850,   // Level 6
    7850,   // Level 7
    15850,  // Level 8
    31850,  // Level 9
    63850   // Level 10
  ];
  const tx5 = await xpManager.setLevelThresholds(levelThresholds);
  await tx5.wait();
  console.log("✓ Level thresholds set:", levelThresholds.join(", "));
  console.log("  Transaction hash:", tx5.hash);
  console.log("");

  // Configuration Step 6: Set LeaderboardSnapshot.setXPManager()
  console.log("6. Configuring LeaderboardSnapshot.setXPManager()...");
  const tx6 = await leaderboardSnapshot.setXPManager(xpManager.address);
  await tx6.wait();
  console.log("✓ LeaderboardSnapshot.xpManager set to:", xpManager.address);
  console.log("  Transaction hash:", tx6.hash);
  console.log("");

  // Verify configuration
  console.log("---");
  console.log("Configuration Verification:");
  console.log("---");
  
  const verifiedBadgeNFT = await xpManager.badgeNFT();
  const verifiedQuestVault = await xpManager.questVault();
  const verifiedXPManagerInBadge = await badgeNFT.xpManager();
  const verifiedXPManagerInVault = await questVault.xpManager();
  const verifiedXPManagerInLeaderboard = await leaderboardSnapshot.xpManager();
  const verifiedMultiplier = await xpManager.xpMultiplier();
  const verifiedMaxEntries = await leaderboardSnapshot.maxEntriesPerSnapshot();
  const verifiedThreshold = await xpManager.getLevelThreshold(5);
  
  console.log("XPManager.badgeNFT:                      ", verifiedBadgeNFT);
  console.log("XPManager.questVault:                    ", verifiedQuestVault);
  console.log("BadgeNFT.xpManager:                      ", verifiedXPManagerInBadge);
  console.log("QuestVault.xpManager:                    ", verifiedXPManagerInVault);
  console.log("LeaderboardSnapshot.xpManager:           ", verifiedXPManagerInLeaderboard);
  console.log("XPManager.xpMultiplier:                  ", verifiedMultiplier.toString());
  console.log("LeaderboardSnapshot.maxEntriesPerSnapshot:", verifiedMaxEntries.toString());
  console.log("XPManager.levelThreshold[5]:             ", verifiedThreshold.toString());
  console.log("---");
  
  // Check if all configurations match
  const allCorrect = 
    verifiedBadgeNFT.toLowerCase() === badgeNFT.address.toLowerCase() &&
    verifiedQuestVault.toLowerCase() === questVault.address.toLowerCase() &&
    verifiedXPManagerInBadge.toLowerCase() === xpManager.address.toLowerCase() &&
    verifiedXPManagerInVault.toLowerCase() === xpManager.address.toLowerCase() &&
    verifiedXPManagerInLeaderboard.toLowerCase() === xpManager.address.toLowerCase() &&
    verifiedMultiplier.toNumber() === 100 &&
    verifiedMaxEntries.toNumber() === 100 &&
    verifiedThreshold.toNumber() === 1850;
  
  if (allCorrect) {
    console.log("✅ All configurations verified successfully!");
  } else {
    console.log("⚠️  Configuration verification failed. Please check the values above.");
  }
  
  console.log("");
  console.log("⚠️  Next step:");
  console.log("Run verification script: npx hardhat run scripts/verify.ts --network <network>");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
