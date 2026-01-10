import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  network: string;
  chainId: number;
  timestamp: string;
  deployer: string;
  testUSDC: string;
  badgeNFT: string;
  xpManager: string;
  questVault: string;
  leaderboardSnapshot: string;
}

async function main() {
  console.log("Starting YieldQuest deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("---\n");

  // Deploy TestUSDC (mock underlying asset for testing)
  console.log("1. Deploying TestUSDC...");
  const TestUSDC = await ethers.getContractFactory("TestUSDC");
  const testUSDC = await TestUSDC.deploy(deployer.address);
  await testUSDC.deployed();
  console.log("✓ TestUSDC deployed to:", testUSDC.address);
  console.log("");

  // Deploy BadgeNFT (no dependencies)
  console.log("2. Deploying BadgeNFT...");
  const BadgeNFT = await ethers.getContractFactory("BadgeNFT");
  const badgeNFT = await BadgeNFT.deploy(deployer.address);
  await badgeNFT.deployed();
  console.log("✓ BadgeNFT deployed to:", badgeNFT.address);
  console.log("");

  // Deploy XPManager (set BadgeNFT address)
  console.log("3. Deploying XPManager...");
  const XPManager = await ethers.getContractFactory("XPManager");
  const initialXPMultiplier = 100; // 100 XP per 1 token yield
  const xpManager = await XPManager.deploy(deployer.address, initialXPMultiplier);
  await xpManager.deployed();
  console.log("✓ XPManager deployed to:", xpManager.address);
  console.log("");

  // Deploy QuestVault (with TestUSDC as underlying asset)
  console.log("4. Deploying QuestVault...");
  const QuestVault = await ethers.getContractFactory("QuestVault");
  const questVault = await QuestVault.deploy(
    testUSDC.address,
    "YieldQuest Vault Shares",
    "yqUSDC",
    deployer.address
  );
  await questVault.deployed();
  console.log("✓ QuestVault deployed to:", questVault.address);
  console.log("");

  // Deploy LeaderboardSnapshot (set XPManager address)
  console.log("5. Deploying LeaderboardSnapshot...");
  const LeaderboardSnapshot = await ethers.getContractFactory("LeaderboardSnapshot");
  const maxEntriesPerSnapshot = 100;
  const leaderboardSnapshot = await LeaderboardSnapshot.deploy(
    deployer.address,
    maxEntriesPerSnapshot,
    xpManager.address
  );
  await leaderboardSnapshot.deployed();
  console.log("✓ LeaderboardSnapshot deployed to:", leaderboardSnapshot.address);
  console.log("");

  // Save deployment addresses
  const deploymentData: DeploymentAddresses = {
    network: network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    testUSDC: testUSDC.address,
    badgeNFT: badgeNFT.address,
    xpManager: xpManager.address,
    questVault: questVault.address,
    leaderboardSnapshot: leaderboardSnapshot.address,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  console.log("---");
  console.log("Deployment Summary:");
  console.log("---");
  console.log("TestUSDC:             ", testUSDC.address);
  console.log("BadgeNFT:             ", badgeNFT.address);
  console.log("XPManager:            ", xpManager.address);
  console.log("QuestVault:           ", questVault.address);
  console.log("LeaderboardSnapshot:  ", leaderboardSnapshot.address);
  console.log("---");
  console.log(`Deployment addresses saved to: ${deploymentFile}`);
  console.log("");
  console.log("⚠️  Next steps:");
  console.log("1. Run configuration script: npx hardhat run scripts/configure.ts --network <network>");
  console.log("2. Verify contracts: npx hardhat run scripts/verify.ts --network <network>");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
