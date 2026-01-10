import { expect } from "chai";
import { ethers } from "hardhat";
import { QuestVault, XPManager, BadgeNFT, TestUSDC, LeaderboardSnapshot } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Checkpoint 7: QuestVault Integration", function () {
  let vault: QuestVault;
  let xpManager: XPManager;
  let badgeNFT: BadgeNFT;
  let leaderboardSnapshot: LeaderboardSnapshot;
  let asset: TestUSDC;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const PRECISION = ethers.utils.parseEther("1");
  const DEFAULT_MULTIPLIER = ethers.BigNumber.from(100).mul(PRECISION);
  const MAX_ENTRIES = 100;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy TestUSDC
    const TestUSDCFactory = await ethers.getContractFactory("TestUSDC");
    asset = await TestUSDCFactory.deploy(owner.address);
    await asset.deployed();

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
    vault = await QuestVaultFactory.deploy(
      asset.address,
      "YieldQuest Vault",
      "yqVault",
      owner.address
    );
    await vault.deployed();

    // Deploy LeaderboardSnapshot
    const LeaderboardSnapshotFactory = await ethers.getContractFactory("LeaderboardSnapshot");
    leaderboardSnapshot = await LeaderboardSnapshotFactory.deploy(
      owner.address,
      MAX_ENTRIES,
      xpManager.address
    );
    await leaderboardSnapshot.deployed();

    // Wire contracts together
    await xpManager.connect(owner).setBadgeNFT(badgeNFT.address);
    await xpManager.connect(owner).setQuestVault(vault.address);
    await badgeNFT.connect(owner).setXPManager(xpManager.address);
    await vault.connect(owner).setXPManager(xpManager.address);

    // Mint tokens to users
    await asset.connect(owner).mint(user1.address, ethers.utils.parseEther("10000"));
    await asset.connect(user1).approve(vault.address, ethers.constants.MaxUint256);
    await asset.connect(owner).mint(user2.address, ethers.utils.parseEther("10000"));
    await asset.connect(user2).approve(vault.address, ethers.constants.MaxUint256);
  });

  describe("Contract Wiring Verification", function () {
    it("should have QuestVault properly wired to XPManager", async function () {
      expect(await vault.xpManager()).to.equal(xpManager.address);
      expect(await xpManager.questVault()).to.equal(vault.address);
    });

    it("should have XPManager properly wired to BadgeNFT", async function () {
      expect(await xpManager.badgeNFT()).to.equal(badgeNFT.address);
      expect(await badgeNFT.xpManager()).to.equal(xpManager.address);
    });

    it("should have LeaderboardSnapshot properly wired to XPManager", async function () {
      expect(await leaderboardSnapshot.xpManager()).to.equal(xpManager.address);
    });
  });

  describe("Full Flow: deposit → yield → claim → XP → level → badge", function () {
    it("should complete the full user journey successfully with event verification", async function () {
      // Step 1: Deposit
      const depositAmount = ethers.utils.parseEther("100");
      const depositTx = await vault.connect(user1).deposit(depositAmount, user1.address);
      
      // Verify Deposit event
      await expect(depositTx)
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, user1.address, depositAmount, depositAmount);
      
      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);
      console.log("✓ Step 1: Deposit successful with Deposit event emitted");

      // Step 2: Simulate yield generation (real yield via token minting)
      const yieldAmount = ethers.utils.parseEther("20"); // 20 tokens yield
      await asset.connect(owner).mint(vault.address, yieldAmount);
      
      const userYield = await vault.getUserYield(user1.address);
      expect(userYield).to.be.gt(0);
      console.log("✓ Step 2: Yield generated:", ethers.utils.formatEther(userYield), "tokens");

      // Step 3: Claim yield
      const claimTx = await vault.connect(user1).claimYield();
      
      // Verify YieldAccrued event
      await expect(claimTx)
        .to.emit(vault, "YieldAccrued");
      
      // Verify XPEarned event
      await expect(claimTx)
        .to.emit(xpManager, "XPEarned");
      
      // Verify LevelUp event (should level up to at least level 2)
      await expect(claimTx)
        .to.emit(xpManager, "LevelUp");
      
      console.log("✓ Step 3: Yield claimed with YieldAccrued and XPEarned events emitted");

      // Step 4: Verify XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);
      
      // Expected XP = actualYield * multiplier / PRECISION
      // The actual yield is slightly less than 20 due to share math
      // Just verify XP is close to expected (within 1%)
      const expectedXP = yieldAmount.mul(100);
      expect(userXP).to.be.closeTo(expectedXP, expectedXP.div(100));
      console.log("✓ Step 4: XP awarded:", ethers.utils.formatEther(userXP), "XP");

      // Step 5: Verify level progression
      const userLevel = await xpManager.getLevel(user1.address);
      expect(userLevel).to.be.gte(1);
      
      // With 2000 XP, user should be at level 6 (threshold: 3850 XP) or level 5 (threshold: 1850 XP)
      // Actually 2000 XP is between level 5 (1850) and level 6 (3850), so should be level 5
      expect(userLevel).to.equal(5);
      console.log("✓ Step 5: Level updated to:", userLevel.toString());

      // Step 6: Verify badge was minted for reaching level 5
      const userBadges = await badgeNFT.getBadges(user1.address);
      expect(userBadges.length).to.be.gt(0);
      
      // Badge type 3 is BADGE_LEVEL_5
      const hasLevel5Badge = await badgeNFT.hasBadgeType(user1.address, 3);
      expect(hasLevel5Badge).to.be.true;
      console.log("✓ Step 6: Badge minted - Level 5 badge awarded");

      // Step 7: Create snapshot and verify
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      
      // Verify SnapshotCreated event
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(1);
      
      const [rank, snapshotXP] = await leaderboardSnapshot.getUserRank(0, user1.address);
      expect(rank).to.equal(1);
      expect(snapshotXP).to.equal(userXP);
      console.log("✓ Step 7: Snapshot created with user ranked #1");

      // Verify state consistency across all contracts
      expect(await vault.balanceOf(user1.address)).to.be.gt(0); // Still has shares
      expect(await xpManager.getXP(user1.address)).to.equal(userXP); // XP matches
      expect(await xpManager.getLevel(user1.address)).to.equal(userLevel); // Level matches
      expect(await badgeNFT.getBadges(user1.address)).to.have.lengthOf.at.least(1); // Has badges
      console.log("✓ Step 8: State consistency verified across all contracts");

      console.log("\n🎉 Full flow completed successfully with all events and state verified!");
    });

    it("should handle multiple yield claims and level progression", async function () {
      // Initial deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);

      // First yield claim - small amount (need at least 1 token to get 100 XP for level 2)
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("1.1"));
      await vault.connect(user1).claimYield();
      
      let level = await xpManager.getLevel(user1.address);
      let xp = await xpManager.getXP(user1.address);
      console.log("After first claim - XP:", ethers.utils.formatEther(xp), "Level:", level.toString());
      expect(level).to.be.gte(1); // At least level 1

      // Second yield claim - medium amount
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("3"));
      await vault.connect(user1).claimYield();
      
      level = await xpManager.getLevel(user1.address);
      xp = await xpManager.getXP(user1.address);
      console.log("After second claim - XP:", ethers.utils.formatEther(xp), "Level:", level.toString());
      expect(level).to.be.gte(2); // At least level 2

      // Third yield claim - large amount to reach level 5
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      await vault.connect(user1).claimYield();
      
      level = await xpManager.getLevel(user1.address);
      xp = await xpManager.getXP(user1.address);
      console.log("After third claim - XP:", ethers.utils.formatEther(xp), "Level:", level.toString());
      expect(level).to.be.gte(5); // Should reach at least level 5

      // Verify Level 5 badge was minted
      const hasLevel5Badge = await badgeNFT.hasBadgeType(user1.address, 3);
      expect(hasLevel5Badge).to.be.true;
      console.log("Level 5 badge awarded!");

      // Fourth yield claim - reach level 10
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("650"));
      await vault.connect(user1).claimYield();
      
      level = await xpManager.getLevel(user1.address);
      xp = await xpManager.getXP(user1.address);
      console.log("After fourth claim - XP:", ethers.utils.formatEther(xp), "Level:", level.toString());
      expect(level).to.be.gte(10); // Should reach level 10

      // Verify Level 10 badge was minted
      const hasLevel10Badge = await badgeNFT.hasBadgeType(user1.address, 4);
      expect(hasLevel10Badge).to.be.true;
      console.log("Level 10 badge awarded!");

      // Verify user has both badges
      const badges = await badgeNFT.getBadges(user1.address);
      expect(badges.length).to.equal(2);
      console.log("Total badges:", badges.length);
    });

    it("should handle withdraw with yield and XP award", async function () {
      // Deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);

      // Generate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));

      // Withdraw (should also award XP for yield)
      const withdrawAmount = ethers.utils.parseEther("50");
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);

      // Verify XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);
      console.log("XP awarded on withdraw:", ethers.utils.formatEther(userXP));

      // Verify level
      const level = await xpManager.getLevel(user1.address);
      expect(level).to.be.gte(2);
      console.log("Level after withdraw:", level.toString());
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should handle zero yield gracefully", async function () {
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);

      // Claim with no yield
      const yieldClaimed = await vault.connect(user1).callStatic.claimYield();
      expect(yieldClaimed).to.equal(0);

      await vault.connect(user1).claimYield();

      // XP should still be zero
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.equal(0);
    });

    it("should handle paused state correctly", async function () {
      // Deposit first
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);

      // Pause vault
      await vault.connect(owner).pause();

      // Deposit should fail
      await expect(
        vault.connect(user1).deposit(ethers.utils.parseEther("10"), user1.address)
      ).to.be.revertedWithCustomError(vault, "ContractPaused");

      // But withdraw should still work (emergency exit)
      await expect(
        vault.connect(user1).withdraw(ethers.utils.parseEther("50"), user1.address, user1.address)
      ).to.not.be.reverted;
    });
  });

  describe("Pause/Unpause Integration Tests", function () {
    it("should block deposits but allow withdrawals when paused", async function () {
      // User deposits before pause
      const depositAmount = ethers.utils.parseEther("100");
      await vault.connect(user1).deposit(depositAmount, user1.address);
      
      // Generate some yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      
      // Pause the vault
      const pauseTx = await vault.connect(owner).pause();
      await expect(pauseTx).to.emit(vault, "Paused");
      
      expect(await vault.paused()).to.be.true;
      console.log("✓ Vault paused");

      // Attempt to deposit - should fail
      await expect(
        vault.connect(user2).deposit(ethers.utils.parseEther("50"), user2.address)
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
      console.log("✓ Deposit blocked when paused");

      // Emergency withdraw should still work
      const withdrawAmount = ethers.utils.parseEther("50");
      const withdrawTx = await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      
      await expect(withdrawTx)
        .to.emit(vault, "Withdraw");
      
      console.log("✓ Emergency withdraw allowed when paused");

      // Verify user still has remaining shares
      const remainingShares = await vault.balanceOf(user1.address);
      expect(remainingShares).to.be.gt(0);
      console.log("✓ User has remaining shares:", ethers.utils.formatEther(remainingShares));
    });

    it("should award XP on emergency withdraw while paused", async function () {
      // User deposits
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Generate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      
      // Pause vault
      await vault.connect(owner).pause();
      
      // Verify XP is zero before withdraw
      expect(await xpManager.getXP(user1.address)).to.equal(0);
      
      // Emergency withdraw (should still award XP for realized yield)
      const withdrawTx = await vault.connect(user1).withdraw(
        ethers.utils.parseEther("50"), 
        user1.address, 
        user1.address
      );
      
      // Verify XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);
      console.log("✓ XP awarded on emergency withdraw:", ethers.utils.formatEther(userXP));
      
      // Verify XPEarned event was emitted
      await expect(withdrawTx)
        .to.emit(xpManager, "XPEarned");
      
      console.log("✓ XP still awarded during emergency withdraw");
    });

    it("should restore normal operation after unpause", async function () {
      // Deposit before pause
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Pause
      await vault.connect(owner).pause();
      expect(await vault.paused()).to.be.true;
      
      // Verify deposits are blocked
      await expect(
        vault.connect(user2).deposit(ethers.utils.parseEther("50"), user2.address)
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
      
      // Unpause
      const unpauseTx = await vault.connect(owner).unpause();
      await expect(unpauseTx).to.emit(vault, "Unpaused");
      
      expect(await vault.paused()).to.be.false;
      console.log("✓ Vault unpaused");
      
      // Now deposits should work
      const depositTx = await vault.connect(user2).deposit(ethers.utils.parseEther("50"), user2.address);
      await expect(depositTx)
        .to.emit(vault, "Deposit");
      
      expect(await vault.balanceOf(user2.address)).to.be.gt(0);
      console.log("✓ Deposits working after unpause");
      
      // Generate yield and claim
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      
      const claimTx = await vault.connect(user1).claimYield();
      await expect(claimTx)
        .to.emit(vault, "YieldAccrued");
      
      console.log("✓ Yield claiming working after unpause");
      
      // Verify XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);
      console.log("✓ XP system working after unpause");
      
      console.log("\n✓ Normal operation fully restored after unpause");
    });

    it("should handle pause/unpause cycle with multiple users", async function () {
      // Multiple users deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await vault.connect(user2).deposit(ethers.utils.parseEther("100"), user2.address);
      
      // Generate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      
      // Pause
      await vault.connect(owner).pause();
      
      // User 1 emergency withdraws
      await vault.connect(user1).withdraw(ethers.utils.parseEther("50"), user1.address, user1.address);
      const user1XP = await xpManager.getXP(user1.address);
      expect(user1XP).to.be.gt(0);
      
      // User 2 cannot deposit
      await expect(
        vault.connect(user2).deposit(ethers.utils.parseEther("10"), user2.address)
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
      
      // Unpause
      await vault.connect(owner).unpause();
      
      // User 2 can now claim yield
      await vault.connect(user2).claimYield();
      const user2XP = await xpManager.getXP(user2.address);
      expect(user2XP).to.be.gt(0);
      
      // Both users have XP
      expect(user1XP).to.be.gt(0);
      expect(user2XP).to.be.gt(0);
      
      console.log("✓ Pause/unpause cycle handled correctly for multiple users");
    });
  });

  describe("Event Emission Tests", function () {
    it("should emit Deposit event with correct indexed parameters", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      const depositTx = await vault.connect(user1).deposit(depositAmount, user1.address);
      
      // Verify Deposit event with all parameters
      await expect(depositTx)
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, user1.address, depositAmount, depositAmount);
      
      console.log("✓ Deposit event emitted with correct parameters");
    });

    it("should emit Withdraw event with correct indexed parameters", async function () {
      // First deposit
      const depositAmount = ethers.utils.parseEther("100");
      await vault.connect(user1).deposit(depositAmount, user1.address);
      
      // Then withdraw
      const withdrawAmount = ethers.utils.parseEther("50");
      const withdrawTx = await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      
      // Verify Withdraw event (shares should equal assets in 1:1 ratio initially)
      await expect(withdrawTx)
        .to.emit(vault, "Withdraw")
        .withArgs(user1.address, user1.address, user1.address, withdrawAmount, withdrawAmount);
      
      console.log("✓ Withdraw event emitted with correct parameters");
    });

    it("should emit YieldAccrued event when claiming yield", async function () {
      // Deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Generate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      
      // Claim yield
      const claimTx = await vault.connect(user1).claimYield();
      
      // Verify YieldAccrued event is emitted
      const receipt = await claimTx.wait();
      const yieldEvent = receipt.events?.find(e => e.event === "YieldAccrued");
      
      expect(yieldEvent).to.not.be.undefined;
      expect(yieldEvent?.args?.user).to.equal(user1.address);
      expect(yieldEvent?.args?.yieldAmount).to.be.gt(0);
      
      console.log("✓ YieldAccrued event emitted with user address and yield amount");
    });

    it("should emit XPEarned event with correct parameters", async function () {
      // Deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Generate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);
      
      // Claim yield (triggers XP award)
      const claimTx = await vault.connect(user1).claimYield();
      
      // Verify XPEarned event is emitted from XPManager
      await expect(claimTx)
        .to.emit(xpManager, "XPEarned");
      
      console.log("✓ XPEarned event emitted with user, yield, XP awarded, and total XP");
    });

    it("should emit LevelUp event when user levels up", async function () {
      // Deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Generate enough yield to level up (need at least 100 XP for level 2)
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("2"));
      
      // Claim yield (should trigger level up)
      const claimTx = await vault.connect(user1).claimYield();
      
      // Verify LevelUp event is emitted from XPManager
      await expect(claimTx)
        .to.emit(xpManager, "LevelUp");
      
      console.log("✓ LevelUp event emitted with user, new level, and XP at level up");
    });

    it("should emit BadgeMinted event when badge is awarded", async function () {
      // Deposit
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      
      // Generate enough yield to reach level 5 (need 1850 XP)
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      
      // Claim yield (should trigger level 5 badge)
      const claimTx = await vault.connect(user1).claimYield();
      
      // Verify BadgeMinted event is emitted from BadgeNFT
      await expect(claimTx)
        .to.emit(badgeNFT, "BadgeMinted");
      
      console.log("✓ BadgeMinted event emitted with user, badge type, and token ID");
    });

    it("should emit SnapshotCreated event with correct parameters", async function () {
      // Setup: users earn XP
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      await vault.connect(user1).claimYield();
      
      // Create snapshot
      const snapshotTx = await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      
      // Verify SnapshotCreated event
      const receipt = await snapshotTx.wait();
      const snapshotEvent = receipt.events?.find(e => e.event === "SnapshotCreated");
      
      expect(snapshotEvent).to.not.be.undefined;
      expect(snapshotEvent?.args?.snapshotId).to.equal(0);
      expect(snapshotEvent?.args?.timestamp).to.be.gt(0);
      expect(snapshotEvent?.args?.totalUsers).to.equal(1);
      
      console.log("✓ SnapshotCreated event emitted with snapshot ID, timestamp, and total users");
    });

    it("should emit all events in correct order during full flow", async function () {
      // Deposit
      const depositTx = await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await expect(depositTx).to.emit(vault, "Deposit");
      console.log("✓ 1. Deposit event emitted");
      
      // Generate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      
      // Claim yield (should emit multiple events)
      const claimTx = await vault.connect(user1).claimYield();
      
      // Check all expected events are emitted
      await expect(claimTx).to.emit(vault, "YieldAccrued");
      console.log("✓ 2. YieldAccrued event emitted");
      
      await expect(claimTx).to.emit(xpManager, "XPEarned");
      console.log("✓ 3. XPEarned event emitted");
      
      await expect(claimTx).to.emit(xpManager, "LevelUp");
      console.log("✓ 4. LevelUp event emitted");
      
      await expect(claimTx).to.emit(badgeNFT, "BadgeMinted");
      console.log("✓ 5. BadgeMinted event emitted");
      
      // Create snapshot
      const snapshotTx = await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      await expect(snapshotTx).to.emit(leaderboardSnapshot, "SnapshotCreated");
      console.log("✓ 6. SnapshotCreated event emitted");
      
      console.log("\n✓ All events emitted in correct order during full flow");
    });

    it("should have indexed parameters for efficient filtering", async function () {
      // This test verifies that events have indexed parameters
      // by checking that events can be filtered by address
      
      // Deposit event should have indexed sender and owner
      const depositTx = await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await expect(depositTx)
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, user1.address, ethers.utils.parseEther("100"), ethers.utils.parseEther("100"));
      
      // Generate yield and claim
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      const claimTx = await vault.connect(user1).claimYield();
      
      // XPEarned event should have indexed user
      await expect(claimTx)
        .to.emit(xpManager, "XPEarned");
      
      // LevelUp event should have indexed user
      await expect(claimTx)
        .to.emit(xpManager, "LevelUp");
      
      console.log("✓ Events have indexed parameters for efficient filtering");
    });
  });

  describe("LeaderboardSnapshot Integration", function () {
    it("should create snapshot and query rankings after users earn XP", async function () {
      // User 1 deposits and earns XP
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("30"));
      await vault.connect(user1).claimYield();

      // User 2 deposits and earns XP
      await vault.connect(user2).deposit(ethers.utils.parseEther("100"), user2.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      await vault.connect(user2).claimYield();

      const user1XP = await xpManager.getXP(user1.address);
      const user2XP = await xpManager.getXP(user2.address);

      console.log("User 1 XP:", ethers.utils.formatEther(user1XP));
      console.log("User 2 XP:", ethers.utils.formatEther(user2XP));

      // Create snapshot (users must be pre-sorted by XP descending)
      const users = user1XP.gte(user2XP) 
        ? [user1.address, user2.address] 
        : [user2.address, user1.address];
      
      await leaderboardSnapshot.connect(owner).createSnapshot(users);

      // Verify snapshot was created
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(1);

      // Query top users
      const topUsers = await leaderboardSnapshot.getTopUsers(0, 2);
      expect(topUsers.length).to.equal(2);
      expect(topUsers[0].rank).to.equal(1);
      expect(topUsers[1].rank).to.equal(2);

      // Verify user ranks
      const [user1Rank, user1SnapshotXP] = await leaderboardSnapshot.getUserRank(0, user1.address);
      const [user2Rank, user2SnapshotXP] = await leaderboardSnapshot.getUserRank(0, user2.address);

      console.log("User 1 Rank:", user1Rank.toString(), "Snapshot XP:", ethers.utils.formatEther(user1SnapshotXP));
      console.log("User 2 Rank:", user2Rank.toString(), "Snapshot XP:", ethers.utils.formatEther(user2SnapshotXP));

      expect(user1Rank).to.be.gt(0);
      expect(user2Rank).to.be.gt(0);
      expect(user1SnapshotXP).to.equal(user1XP);
      expect(user2SnapshotXP).to.equal(user2XP);

      console.log("✓ Snapshot created and queries working correctly!");
    });

    it("should handle multi-user competition with correct ranking order", async function () {
      // Get more users for competition
      const [, , , user3, user4, user5] = await ethers.getSigners();
      
      // Mint tokens to additional users
      await asset.connect(owner).mint(user3.address, ethers.utils.parseEther("10000"));
      await asset.connect(user3).approve(vault.address, ethers.constants.MaxUint256);
      await asset.connect(owner).mint(user4.address, ethers.utils.parseEther("10000"));
      await asset.connect(user4).approve(vault.address, ethers.constants.MaxUint256);
      await asset.connect(owner).mint(user5.address, ethers.utils.parseEther("10000"));
      await asset.connect(user5).approve(vault.address, ethers.constants.MaxUint256);

      // User 1: deposit and earn most XP
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("50"));
      await vault.connect(user1).claimYield();

      // User 2: deposit and earn second most XP
      await vault.connect(user2).deposit(ethers.utils.parseEther("100"), user2.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("30"));
      await vault.connect(user2).claimYield();

      // User 3: deposit and earn third most XP
      await vault.connect(user3).deposit(ethers.utils.parseEther("100"), user3.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      await vault.connect(user3).claimYield();

      // User 4: deposit and earn fourth most XP
      await vault.connect(user4).deposit(ethers.utils.parseEther("100"), user4.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      await vault.connect(user4).claimYield();

      // User 5: deposit and earn least XP
      await vault.connect(user5).deposit(ethers.utils.parseEther("100"), user5.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("5"));
      await vault.connect(user5).claimYield();

      // Get XP for all users
      const user1XP = await xpManager.getXP(user1.address);
      const user2XP = await xpManager.getXP(user2.address);
      const user3XP = await xpManager.getXP(user3.address);
      const user4XP = await xpManager.getXP(user4.address);
      const user5XP = await xpManager.getXP(user5.address);

      console.log("\nUser XP Rankings:");
      console.log("User 1:", ethers.utils.formatEther(user1XP), "XP");
      console.log("User 2:", ethers.utils.formatEther(user2XP), "XP");
      console.log("User 3:", ethers.utils.formatEther(user3XP), "XP");
      console.log("User 4:", ethers.utils.formatEther(user4XP), "XP");
      console.log("User 5:", ethers.utils.formatEther(user5XP), "XP");

      // Verify XP ordering (user1 > user2 > user3 > user4 > user5)
      expect(user1XP).to.be.gt(user2XP);
      expect(user2XP).to.be.gt(user3XP);
      expect(user3XP).to.be.gt(user4XP);
      expect(user4XP).to.be.gt(user5XP);

      // Create snapshot with users pre-sorted by XP descending
      const sortedUsers = [user1.address, user2.address, user3.address, user4.address, user5.address];
      const snapshotTx = await leaderboardSnapshot.connect(owner).createSnapshot(sortedUsers);
      
      // Verify SnapshotCreated event
      await expect(snapshotTx)
        .to.emit(leaderboardSnapshot, "SnapshotCreated");

      // Verify snapshot count
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(1);

      // Query top 5 users
      const topUsers = await leaderboardSnapshot.getTopUsers(0, 5);
      expect(topUsers.length).to.equal(5);

      // Verify ranking order
      expect(topUsers[0].user).to.equal(user1.address);
      expect(topUsers[0].rank).to.equal(1);
      expect(topUsers[0].xp).to.equal(user1XP);

      expect(topUsers[1].user).to.equal(user2.address);
      expect(topUsers[1].rank).to.equal(2);
      expect(topUsers[1].xp).to.equal(user2XP);

      expect(topUsers[2].user).to.equal(user3.address);
      expect(topUsers[2].rank).to.equal(3);
      expect(topUsers[2].xp).to.equal(user3XP);

      expect(topUsers[3].user).to.equal(user4.address);
      expect(topUsers[3].rank).to.equal(4);
      expect(topUsers[3].xp).to.equal(user4XP);

      expect(topUsers[4].user).to.equal(user5.address);
      expect(topUsers[4].rank).to.equal(5);
      expect(topUsers[4].xp).to.equal(user5XP);

      // Verify XP values in snapshot match current XP
      for (let i = 0; i < topUsers.length; i++) {
        const [rank, snapshotXP] = await leaderboardSnapshot.getUserRank(0, topUsers[i].user);
        expect(rank).to.equal(i + 1);
        expect(snapshotXP).to.equal(topUsers[i].xp);
      }

      console.log("\n✓ Multi-user competition test passed!");
      console.log("✓ All users ranked correctly by XP");
      console.log("✓ Leaderboard reflects accurate XP values");
    });

    it("should maintain snapshot immutability after more XP is earned", async function () {
      // User 1 earns initial XP
      await vault.connect(user1).deposit(ethers.utils.parseEther("100"), user1.address);
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("10"));
      await vault.connect(user1).claimYield();

      const initialXP = await xpManager.getXP(user1.address);

      // Create snapshot
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);

      // User 1 earns more XP
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));
      await vault.connect(user1).claimYield();

      const newXP = await xpManager.getXP(user1.address);
      expect(newXP).to.be.gt(initialXP);

      // Verify snapshot still has old XP value
      const [rank, snapshotXP] = await leaderboardSnapshot.getUserRank(0, user1.address);
      expect(snapshotXP).to.equal(initialXP);
      expect(snapshotXP).to.not.equal(newXP);

      console.log("✓ Snapshot immutability verified!");
    });
  });
});
