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
  console.log("🔧 Generating Hardhat verify commands...\n");

  const network = await ethers.provider.getNetwork();
  
  // Load deployment addresses
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}-${network.chainId}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deploymentData: DeploymentAddresses = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const deployerAddress = deploymentData.deployer;

  console.log("📋 DEPLOYMENT INFO:");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Deployer:", deployerAddress);
  console.log("");

  console.log("🚀 COPY AND RUN THESE COMMANDS:");
  console.log("=".repeat(80));
  console.log("");

  // 1. TestUSDC
  console.log("# 1. Verify TestUSDC");
  console.log(`npx hardhat verify --network mantleSepolia ${deploymentData.testUSDC} "${deployerAddress}"`);
  console.log("");

  // 2. BadgeNFT
  console.log("# 2. Verify BadgeNFT");
  console.log(`npx hardhat verify --network mantleSepolia ${deploymentData.badgeNFT} "${deployerAddress}"`);
  console.log("");

  // 3. XPManager
  console.log("# 3. Verify XPManager");
  console.log(`npx hardhat verify --network mantleSepolia ${deploymentData.xpManager} "${deployerAddress}" 100`);
  console.log("");

  // 4. QuestVault
  console.log("# 4. Verify QuestVault");
  console.log(`npx hardhat verify --network mantleSepolia ${deploymentData.questVault} "${deploymentData.testUSDC}" "YieldQuest Vault Shares" "yqUSDC" "${deployerAddress}"`);
  console.log("");

  // 5. LeaderboardSnapshot
  console.log("# 5. Verify LeaderboardSnapshot");
  console.log(`npx hardhat verify --network mantleSepolia ${deploymentData.leaderboardSnapshot} "${deployerAddress}" 100 "${deploymentData.xpManager}"`);
  console.log("");

  console.log("=".repeat(80));
  console.log("");

  // Also create a batch file for Windows
  const batchCommands = [
    `@echo off`,
    `echo Verifying YieldQuest contracts on Mantle Sepolia...`,
    `echo.`,
    `echo 1/5 Verifying TestUSDC...`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.testUSDC} "${deployerAddress}"`,
    `echo.`,
    `echo 2/5 Verifying BadgeNFT...`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.badgeNFT} "${deployerAddress}"`,
    `echo.`,
    `echo 3/5 Verifying XPManager...`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.xpManager} "${deployerAddress}" 100`,
    `echo.`,
    `echo 4/5 Verifying QuestVault...`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.questVault} "${deploymentData.testUSDC}" "YieldQuest Vault Shares" "yqUSDC" "${deployerAddress}"`,
    `echo.`,
    `echo 5/5 Verifying LeaderboardSnapshot...`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.leaderboardSnapshot} "${deployerAddress}" 100 "${deploymentData.xpManager}"`,
    `echo.`,
    `echo All verification commands completed!`,
    `pause`
  ];

  const batchFile = path.join(__dirname, "..", "verify-all.bat");
  fs.writeFileSync(batchFile, batchCommands.join('\n'));

  // Create a shell script for Unix systems
  const shellCommands = [
    `#!/bin/bash`,
    `echo "Verifying YieldQuest contracts on Mantle Sepolia..."`,
    `echo ""`,
    `echo "1/5 Verifying TestUSDC..."`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.testUSDC} "${deployerAddress}"`,
    `echo ""`,
    `echo "2/5 Verifying BadgeNFT..."`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.badgeNFT} "${deployerAddress}"`,
    `echo ""`,
    `echo "3/5 Verifying XPManager..."`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.xpManager} "${deployerAddress}" 100`,
    `echo ""`,
    `echo "4/5 Verifying QuestVault..."`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.questVault} "${deploymentData.testUSDC}" "YieldQuest Vault Shares" "yqUSDC" "${deployerAddress}"`,
    `echo ""`,
    `echo "5/5 Verifying LeaderboardSnapshot..."`,
    `npx hardhat verify --network mantleSepolia ${deploymentData.leaderboardSnapshot} "${deployerAddress}" 100 "${deploymentData.xpManager}"`,
    `echo ""`,
    `echo "All verification commands completed!"`
  ];

  const shellFile = path.join(__dirname, "..", "verify-all.sh");
  fs.writeFileSync(shellFile, shellCommands.join('\n'));

  console.log("📁 BATCH FILES CREATED:");
  console.log("Windows: verify-all.bat");
  console.log("Unix/Mac: verify-all.sh");
  console.log("");
  console.log("💡 TIP: You can run the batch file or copy-paste individual commands above");
  console.log("");
  console.log("🔗 EXPLORER LINKS:");
  console.log(`TestUSDC:             https://explorer.sepolia.mantle.xyz/address/${deploymentData.testUSDC}`);
  console.log(`BadgeNFT:             https://explorer.sepolia.mantle.xyz/address/${deploymentData.badgeNFT}`);
  console.log(`XPManager:            https://explorer.sepolia.mantle.xyz/address/${deploymentData.xpManager}`);
  console.log(`QuestVault:           https://explorer.sepolia.mantle.xyz/address/${deploymentData.questVault}`);
  console.log(`LeaderboardSnapshot:  https://explorer.sepolia.mantle.xyz/address/${deploymentData.leaderboardSnapshot}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });