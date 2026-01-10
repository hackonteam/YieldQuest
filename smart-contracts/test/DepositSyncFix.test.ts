import { expect } from "chai";
import { ethers } from "hardhat";
import { QuestVault, XPManager, BadgeNFT, TestUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Deposit Sync Fix - Prevent Deposit-as-Yield Bug", function () {
  let questVault: QuestVault;
  let xpManager: XPManager;
  let badgeNFT: BadgeNFT;
  let testUSDC: TestUSDC;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  const PRECISION = ethers.utils.parseEther("1");
  const DEFAULT_MULTIPLIER = ethers.BigNumber.from(100).mul(PRECISION);

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy TestUSDC
    const TestUSDCFactory = await ethers.getContractFactory("TestUSDC");
    testUSDC = await TestUSDCFactory.deploy(owner.address);
    await testUSDC.deployed();

    // Deploy BadgeNFT
    const BadgeNFTFactory = await ethers.getContractFactory("BadgeNFT");
    badgeNFT = await BadgeNFTFactory.deploy(owner.address);
    await badgeNFT.deployed();

    // Deploy XPManager
    const XPManagerFactory = await ethers.getContractFactory("XPManager");
    xpManager = await XPManagerFactory.deploy(owner.address, DEFAULT_MULTIPLIER);
    await xpManager.deployed();

    // Deploy QuestVault
    const QuestVaultFactory = await ethers.getContractFactory("QuestVault");
    questVault = await QuestVaultFactory.deploy(
      testUSDC.address,
      "Quest Vault Shares",
      "QVS",
      owner.address
    );
    await questVault.deployed();

    // Wire contracts together
    await xpManager.setBadgeNFT(badgeNFT.address);
    await xpManager.setQuestVault(questVault.address);
    await badgeNFT.setXPManager(xpManager.address);
    await questVault.setXPManager(xpManager.address);

    // Mint test tokens to user
    await testUSDC.mint(user.address, ethers.utils.parseEther("10000"));
    await testUSDC.connect(user).approve(questVault.address, ethers.utils.parseEther("10000"));
  });

  describe("Deposit-as-Yield Bug Prevention", function () {
    it("should NOT award XP for additional deposits (principal should not be treated as yield)", async function () {
      console.log("🧪 Testing the exact scenario you described:");
      console.log("1. Deposit 1000 USDC");
      console.log("2. Deposit additional 2000 USDC");
      console.log("3. Verify no XP is awarded for the additional deposit");

      // Step 1: First deposit of 1000 USDC
      const firstDeposit = ethers.utils.parseEther("1000");
      await questVault.connect(user).deposit(firstDeposit, user.address);
      
      const xpAfterFirstDeposit = await xpManager.getXP(user.address);
      const lastClaimedAfterFirst = await questVault.lastClaimedAssets(user.address);
      
      console.log(`✅ After first deposit:`);
      console.log(`   - User shares: ${ethers.utils.formatEther(await questVault.balanceOf(user.address))}`);
      console.log(`   - lastClaimedAssets: ${ethers.utils.formatEther(lastClaimedAfterFirst)}`);
      console.log(`   - XP: ${ethers.utils.formatEther(xpAfterFirstDeposit)}`);
      
      expect(xpAfterFirstDeposit).to.equal(0, "No XP should be awarded for first deposit");
      expect(lastClaimedAfterFirst).to.equal(firstDeposit, "lastClaimedAssets should equal deposit amount");

      // Step 2: Second deposit of 2000 USDC (this was causing the bug)
      const secondDeposit = ethers.utils.parseEther("2000");
      await questVault.connect(user).deposit(secondDeposit, user.address);
      
      const xpAfterSecondDeposit = await xpManager.getXP(user.address);
      const lastClaimedAfterSecond = await questVault.lastClaimedAssets(user.address);
      const totalShares = await questVault.balanceOf(user.address);
      const totalAssets = await questVault.convertToAssets(totalShares);
      
      console.log(`✅ After second deposit:`);
      console.log(`   - User shares: ${ethers.utils.formatEther(totalShares)}`);
      console.log(`   - Total assets: ${ethers.utils.formatEther(totalAssets)}`);
      console.log(`   - lastClaimedAssets: ${ethers.utils.formatEther(lastClaimedAfterSecond)}`);
      console.log(`   - XP: ${ethers.utils.formatEther(xpAfterSecondDeposit)}`);
      
      // CRITICAL: XP should still be 0 after second deposit
      expect(xpAfterSecondDeposit).to.equal(0, "No XP should be awarded for additional deposits");
      
      // CRITICAL: lastClaimedAssets should be synced to current total
      expect(lastClaimedAfterSecond).to.equal(totalAssets, "lastClaimedAssets should be synced to current asset value");
      
      // Step 3: Verify no yield is available to claim (since no real yield generated)
      const availableYield = await questVault.getUserYield(user.address);
      console.log(`✅ Available yield: ${ethers.utils.formatEther(availableYield)}`);
      expect(availableYield).to.equal(0, "No yield should be available since no real yield was generated");

      console.log("🎉 SUCCESS: Additional deposits are NOT treated as yield!");
    });

    it("should reproduce and verify the fix for the original bug scenario", async function () {
      console.log("🐛 Reproducing the original bug scenario (now fixed):");
      console.log("Original issue: deposit 1000, then deposit 2000 → incorrectly awarded 200,000 XP");
      
      // Exact scenario from the bug report
      const firstDeposit = ethers.utils.parseEther("1000");
      const secondDeposit = ethers.utils.parseEther("2000");
      
      // Step 1: First deposit
      await questVault.connect(user).deposit(firstDeposit, user.address);
      
      const stateAfterFirst = {
        shares: await questVault.balanceOf(user.address),
        lastClaimed: await questVault.lastClaimedAssets(user.address),
        totalAssets: await questVault.totalAssets(),
        xp: await xpManager.getXP(user.address)
      };
      
      console.log("📊 State after first deposit:");
      console.log(`   - User deposit: ${ethers.utils.formatEther(firstDeposit)} USDC`);
      console.log(`   - lastClaimedAssets: ${ethers.utils.formatEther(stateAfterFirst.lastClaimed)} USDC`);
      console.log(`   - shares: ${ethers.utils.formatEther(stateAfterFirst.shares)}`);
      console.log(`   - totalAssets: ${ethers.utils.formatEther(stateAfterFirst.totalAssets)} USDC`);
      console.log(`   - XP: ${ethers.utils.formatEther(stateAfterFirst.xp)} ✅`);
      
      expect(stateAfterFirst.xp).to.equal(0, "No XP after first deposit");
      expect(stateAfterFirst.lastClaimed).to.equal(firstDeposit, "lastClaimedAssets should equal first deposit");
      
      // Step 2: Second deposit (this was the problematic step)
      await questVault.connect(user).deposit(secondDeposit, user.address);
      
      const stateAfterSecond = {
        shares: await questVault.balanceOf(user.address),
        lastClaimed: await questVault.lastClaimedAssets(user.address),
        totalAssets: await questVault.totalAssets(),
        xp: await xpManager.getXP(user.address),
        userAssets: await questVault.convertToAssets(await questVault.balanceOf(user.address))
      };
      
      console.log("📊 State after second deposit:");
      console.log(`   - User total assets: ${ethers.utils.formatEther(stateAfterSecond.userAssets)} USDC`);
      console.log(`   - lastClaimedAssets: ${ethers.utils.formatEther(stateAfterSecond.lastClaimed)} USDC`);
      console.log(`   - shares: ${ethers.utils.formatEther(stateAfterSecond.shares)}`);
      console.log(`   - totalAssets: ${ethers.utils.formatEther(stateAfterSecond.totalAssets)} USDC`);
      console.log(`   - XP: ${ethers.utils.formatEther(stateAfterSecond.xp)} ✅`);
      
      // CRITICAL ASSERTIONS: The bug is now fixed
      expect(stateAfterSecond.xp).to.equal(0, "❌ BUG FIXED: No XP should be awarded for additional deposits");
      expect(stateAfterSecond.lastClaimed).to.equal(stateAfterSecond.userAssets, "lastClaimedAssets should be synced");
      
      // Step 3: Verify no false yield is available
      const availableYield = await questVault.getUserYield(user.address);
      console.log(`   - Available yield: ${ethers.utils.formatEther(availableYield)} USDC ✅`);
      
      expect(availableYield).to.equal(0, "No false yield should be available");
      
      console.log("🎉 SUCCESS: Original bug scenario is now fixed!");
      console.log("✅ Additional deposits no longer generate false yield");
      console.log("✅ XP is only awarded for real yield, not principal");
    });
  });
});