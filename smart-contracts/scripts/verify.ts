import { run, ethers } from "hardhat";
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
  deployer?: string; // Optional for backwards compatibility
}

async function main() {
  console.log("Starting contract verification...\n");

  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("---\n");

  // Load deployment addresses
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}-${network.chainId}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please run deploy.ts first.`);
  }

  const deploymentData: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  console.log("Loaded deployment addresses:");
  console.log("TestUSDC:             ", deploymentData.testUSDC);
  console.log("BadgeNFT:             ", deploymentData.badgeNFT);
  console.log("XPManager:            ", deploymentData.xpManager);
  console.log("QuestVault:           ", deploymentData.questVault);
  console.log("LeaderboardSnapshot:  ", deploymentData.leaderboardSnapshot);
  console.log("---\n");

  // Get deployer address for constructor arguments
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deploymentData.deployer || deployer.address;

  // Verify TestUSDC
  console.log("1. Verifying TestUSDC...");
  try {
    await run("verify:verify", {
      address: deploymentData.testUSDC,
      constructorArguments: [deployerAddress],
    });
    console.log("✓ TestUSDC verified");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ TestUSDC already verified");
    } else {
      console.log("✗ TestUSDC verification failed:", error.message);
    }
  }
  console.log("");

  // Verify BadgeNFT
  console.log("2. Verifying BadgeNFT...");
  try {
    await run("verify:verify", {
      address: deploymentData.badgeNFT,
      constructorArguments: [deployerAddress],
    });
    console.log("✓ BadgeNFT verified");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ BadgeNFT already verified");
    } else {
      console.log("✗ BadgeNFT verification failed:", error.message);
    }
  }
  console.log("");

  // Verify XPManager
  console.log("3. Verifying XPManager...");
  try {
    await run("verify:verify", {
      address: deploymentData.xpManager,
      constructorArguments: [deployerAddress, 100], // initialOwner, initialXPMultiplier
    });
    console.log("✓ XPManager verified");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ XPManager already verified");
    } else {
      console.log("✗ XPManager verification failed:", error.message);
    }
  }
  console.log("");

  // Verify QuestVault
  console.log("4. Verifying QuestVault...");
  try {
    await run("verify:verify", {
      address: deploymentData.questVault,
      constructorArguments: [
        deploymentData.testUSDC,
        "YieldQuest Vault Shares",
        "yqUSDC",
        deployerAddress,
      ],
    });
    console.log("✓ QuestVault verified");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ QuestVault already verified");
    } else {
      console.log("✗ QuestVault verification failed:", error.message);
    }
  }
  console.log("");

  // Verify LeaderboardSnapshot
  console.log("5. Verifying LeaderboardSnapshot...");
  try {
    await run("verify:verify", {
      address: deploymentData.leaderboardSnapshot,
      constructorArguments: [deployerAddress, 100, deploymentData.xpManager], // initialOwner, maxEntries, xpManager
    });
    console.log("✓ LeaderboardSnapshot verified");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✓ LeaderboardSnapshot already verified");
    } else {
      console.log("✗ LeaderboardSnapshot verification failed:", error.message);
    }
  }
  console.log("");

  // Export ABIs
  console.log("---");
  console.log("Exporting ABIs for frontend integration...");
  console.log("---\n");

  const abisDir = path.join(__dirname, "..", "abis");
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  const contracts = [
    { name: "TestUSDC", path: "contracts/TestUSDC.sol/TestUSDC.json" },
    { name: "BadgeNFT", path: "contracts/BadgeNFT.sol/BadgeNFT.json" },
    { name: "XPManager", path: "contracts/XPManager.sol/XPManager.json" },
    { name: "QuestVault", path: "contracts/QuestVault.sol/QuestVault.json" },
    { name: "LeaderboardSnapshot", path: "contracts/LeaderboardSnapshot.sol/LeaderboardSnapshot.json" },
  ];

  for (const contract of contracts) {
    const artifactPath = path.join(__dirname, "..", "artifacts", contract.path);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiPath = path.join(abisDir, `${contract.name}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`✓ Exported ${contract.name} ABI to: abis/${contract.name}.json`);
    } else {
      console.log(`✗ Artifact not found for ${contract.name}: ${artifactPath}`);
    }
  }

  console.log("");

  // Create a comprehensive deployments.json file
  console.log("---");
  console.log("Creating comprehensive deployments.json...");
  console.log("---\n");

  const comprehensiveDeployment = {
    ...deploymentData,
    contracts: {
      TestUSDC: {
        address: deploymentData.testUSDC,
        abi: "abis/TestUSDC.json",
      },
      BadgeNFT: {
        address: deploymentData.badgeNFT,
        abi: "abis/BadgeNFT.json",
      },
      XPManager: {
        address: deploymentData.xpManager,
        abi: "abis/XPManager.json",
      },
      QuestVault: {
        address: deploymentData.questVault,
        abi: "abis/QuestVault.json",
      },
      LeaderboardSnapshot: {
        address: deploymentData.leaderboardSnapshot,
        abi: "abis/LeaderboardSnapshot.json",
      },
    },
  };

  const deploymentsJsonPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentsJsonPath, JSON.stringify(comprehensiveDeployment, null, 2));
  console.log("✓ Created deployments.json with contract addresses and ABI paths");
  console.log("");

  console.log("---");
  console.log("✅ Verification and export complete!");
  console.log("---");
  console.log("");
  console.log("Frontend Integration Files:");
  console.log("- Contract addresses: deployments.json");
  console.log("- ABIs: abis/*.json");
  console.log("");
  console.log("Block Explorer Links:");
  console.log(`- TestUSDC:             https://explorer.sepolia.mantle.xyz/address/${deploymentData.testUSDC}`);
  console.log(`- BadgeNFT:             https://explorer.sepolia.mantle.xyz/address/${deploymentData.badgeNFT}`);
  console.log(`- XPManager:            https://explorer.sepolia.mantle.xyz/address/${deploymentData.xpManager}`);
  console.log(`- QuestVault:           https://explorer.sepolia.mantle.xyz/address/${deploymentData.questVault}`);
  console.log(`- LeaderboardSnapshot:  https://explorer.sepolia.mantle.xyz/address/${deploymentData.leaderboardSnapshot}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
