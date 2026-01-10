import { expect } from "chai";
import { ethers } from "hardhat";
import { QuestVault, XPManager, BadgeNFT, TestUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("QuestVault", function () {
  let vault: QuestVault;
  let xpManager: XPManager;
  let badgeNFT: BadgeNFT;
  let asset: TestUSDC;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const PRECISION = ethers.utils.parseEther("1");
  const DEFAULT_MULTIPLIER = ethers.BigNumber.from(100).mul(PRECISION);
  const INITIAL_DEPOSIT = ethers.utils.parseEther("100");

  beforeEach(async function () {
    [owner, user1, user2, unauthorized] = await ethers.getSigners();

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

    // Configure contracts
    await xpManager.connect(owner).setBadgeNFT(badgeNFT.address);
    await xpManager.connect(owner).setQuestVault(vault.address);
    await badgeNFT.connect(owner).setXPManager(xpManager.address);
    await vault.connect(owner).setXPManager(xpManager.address);

    // Mint tokens to users
    await asset.connect(owner).mint(user1.address, ethers.utils.parseEther("10000"));
    await asset.connect(owner).mint(user2.address, ethers.utils.parseEther("10000"));

    // Approve vault to spend tokens
    await asset.connect(user1).approve(vault.address, ethers.constants.MaxUint256);
    await asset.connect(user2).approve(vault.address, ethers.constants.MaxUint256);
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("should set the correct asset", async function () {
      expect(await vault.asset()).to.equal(asset.address);
    });

    it("should have correct name and symbol", async function () {
      expect(await vault.name()).to.equal("YieldQuest Vault");
      expect(await vault.symbol()).to.equal("yqVault");
    });

    it("should not be paused initially", async function () {
      expect(await vault.paused()).to.be.false;
    });
  });

  describe("Deposit Functionality", function () {
    it("should allow users to deposit assets", async function () {
      const depositAmount = INITIAL_DEPOSIT;

      await expect(vault.connect(user1).deposit(depositAmount, user1.address))
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, user1.address, depositAmount, depositAmount);

      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);
      expect(await vault.totalAssets()).to.equal(depositAmount);
    });

    it("should track deposit timestamp", async function () {
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
      
      const timestamp = await vault.depositTimestamp(user1.address);
      expect(timestamp).to.be.gt(0);
    });

    it("should initialize lastClaimedAssets on first deposit", async function () {
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
      
      const lastClaimed = await vault.lastClaimedAssets(user1.address);
      expect(lastClaimed).to.equal(INITIAL_DEPOSIT);
    });

    it("should revert on zero deposit", async function () {
      await expect(
        vault.connect(user1).deposit(0, user1.address)
      ).to.be.revertedWithCustomError(vault, "ZeroDeposit");
    });

    it("should revert deposit when paused", async function () {
      // Feature: yieldquest, Property 11: Pause Behavior - Deposit Blocked
      await vault.connect(owner).pause();

      await expect(
        vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address)
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
    });

    it("should mint correct shares based on ERC-4626 math", async function () {
      // Feature: yieldquest, Property 2: Share Proportionality Invariant
      const depositAmount = ethers.utils.parseEther("100");

      // First deposit: shares = assets (1:1 ratio)
      await vault.connect(user1).deposit(depositAmount, user1.address);
      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);

      // Simulate yield by minting tokens to vault
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Second deposit: shares should be proportional
      const totalAssetsBefore = await vault.totalAssets();
      const totalSupplyBefore = await vault.totalSupply();
      
      await vault.connect(user2).deposit(depositAmount, user2.address);
      
      const expectedShares = depositAmount.mul(totalSupplyBefore).div(totalAssetsBefore);
      expect(await vault.balanceOf(user2.address)).to.equal(expectedShares);
    });
  });

  describe("Withdraw Functionality", function () {
    beforeEach(async function () {
      // User1 deposits
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
    });

    it("should allow users to withdraw assets", async function () {
      const withdrawAmount = ethers.utils.parseEther("50");

      await expect(vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
        .to.emit(vault, "Withdraw");

      expect(await asset.balanceOf(user1.address)).to.be.gte(withdrawAmount);
    });

    it("should allow withdraw even when paused (emergency exit)", async function () {
      // Feature: yieldquest, Property 12: Pause Behavior - Withdraw Allowed
      await vault.connect(owner).pause();

      const withdrawAmount = ethers.utils.parseEther("50");

      await expect(
        vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address)
      ).to.not.be.reverted;
    });

    it("should perform deposit-withdraw round trip correctly", async function () {
      // Feature: yieldquest, Property 1: Deposit-Withdraw Round Trip
      // Note: beforeEach already deposited INITIAL_DEPOSIT for user1
      
      // Get balance before withdrawal
      const balanceBefore = await asset.balanceOf(user1.address);
      
      // Get all shares
      const shares = await vault.balanceOf(user1.address);
      const expectedAssets = await vault.convertToAssets(shares);

      // Withdraw all
      await vault.connect(user1).redeem(shares, user1.address, user1.address);

      const finalBalance = await asset.balanceOf(user1.address);
      
      // Should get back the assets corresponding to shares (no yield in this test)
      expect(finalBalance).to.equal(balanceBefore.add(expectedAssets));
    });

    it("should calculate and award XP on withdraw with yield", async function () {
      // Simulate yield by minting tokens to vault
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Withdraw
      const withdrawAmount = ethers.utils.parseEther("50");
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);

      // Check XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);
    });

    it("should emit YieldAccrued event on withdraw with yield", async function () {
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Withdraw
      const withdrawAmount = ethers.utils.parseEther("50");
      
      await expect(vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address))
        .to.emit(vault, "YieldAccrued");
    });

    it("should update lastClaimedAssets after withdraw", async function () {
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Withdraw
      const withdrawAmount = ethers.utils.parseEther("50");
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);

      // lastClaimedAssets should be updated to remaining value
      const remainingShares = await vault.balanceOf(user1.address);
      const expectedLastClaimed = await vault.convertToAssets(remainingShares);
      const actualLastClaimed = await vault.lastClaimedAssets(user1.address);
      
      expect(actualLastClaimed).to.equal(expectedLastClaimed);
    });
  });

  describe("ClaimYield Functionality", function () {
    beforeEach(async function () {
      // User1 deposits
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
    });

    it("should allow users to claim yield without withdrawing principal", async function () {
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      const sharesBefore = await vault.balanceOf(user1.address);
      
      await vault.connect(user1).claimYield();

      const sharesAfter = await vault.balanceOf(user1.address);
      
      // Shares should remain the same
      expect(sharesAfter).to.equal(sharesBefore);
    });

    it("should award XP when claiming yield", async function () {
      // Feature: yieldquest, Property 14: XP Only From Realized Yield
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      const xpBefore = await xpManager.getXP(user1.address);
      
      await vault.connect(user1).claimYield();

      const xpAfter = await xpManager.getXP(user1.address);
      
      // XP should increase
      expect(xpAfter).to.be.gt(xpBefore);
    });

    it("should emit YieldAccrued event when claiming yield", async function () {
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      await expect(vault.connect(user1).claimYield())
        .to.emit(vault, "YieldAccrued");
    });

    it("should return zero yield when no yield has accrued", async function () {
      const yieldClaimed = await vault.connect(user1).callStatic.claimYield();
      expect(yieldClaimed).to.equal(0);
    });

    it("should update lastClaimedAssets after claiming", async function () {
      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      await vault.connect(user1).claimYield();

      const currentAssets = await vault.convertToAssets(await vault.balanceOf(user1.address));
      const lastClaimed = await vault.lastClaimedAssets(user1.address);
      
      expect(lastClaimed).to.equal(currentAssets);
    });

    it("should not award XP if no yield has accrued", async function () {
      const xpBefore = await xpManager.getXP(user1.address);
      
      await vault.connect(user1).claimYield();

      const xpAfter = await xpManager.getXP(user1.address);
      
      expect(xpAfter).to.equal(xpBefore);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
    });

    it("should return correct user yield", async function () {
      // No yield initially
      expect(await vault.getUserYield(user1.address)).to.equal(0);

      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Should show yield
      const userYield = await vault.getUserYield(user1.address);
      expect(userYield).to.be.gt(0);
    });

    it("should return correct balanceOf", async function () {
      expect(await vault.balanceOf(user1.address)).to.equal(INITIAL_DEPOSIT);
    });

    it("should return correct totalAssets", async function () {
      expect(await vault.totalAssets()).to.equal(INITIAL_DEPOSIT);

      // After yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      expect(await vault.totalAssets()).to.equal(INITIAL_DEPOSIT.add(yieldAmount));
    });

    it("should convert shares to assets correctly", async function () {
      const shares = await vault.balanceOf(user1.address);
      const assets = await vault.convertToAssets(shares);
      
      expect(assets).to.equal(INITIAL_DEPOSIT);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set XPManager", async function () {
      const newManager = user2.address;

      await expect(vault.connect(owner).setXPManager(newManager))
        .to.emit(vault, "XPManagerUpdated")
        .withArgs(xpManager.address, newManager);

      expect(await vault.xpManager()).to.equal(newManager);
    });

    it("should allow owner to pause", async function () {
      await vault.connect(owner).pause();
      expect(await vault.paused()).to.be.true;
    });

    it("should allow owner to unpause", async function () {
      await vault.connect(owner).pause();
      await vault.connect(owner).unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("should revert when non-owner tries to pause", async function () {
      await expect(
        vault.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("should revert when non-owner tries to set XPManager", async function () {
      await expect(
        vault.connect(unauthorized).setXPManager(user2.address)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Property Tests - Multiple Users", function () {
    it("should maintain share proportionality across multiple deposits", async function () {
      // Feature: yieldquest, Property 2: Share Proportionality Invariant
      
      // First deposit by user1
      const deposit1 = ethers.utils.parseEther("100");
      await vault.connect(user1).deposit(deposit1, user1.address);
      
      // Shares should equal assets for first deposit (1:1)
      expect(await vault.balanceOf(user1.address)).to.equal(deposit1);

      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("10");
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Second deposit by user2
      const deposit2 = ethers.utils.parseEther("50");
      const totalAssetsBefore = await vault.totalAssets();
      const totalSupplyBefore = await vault.totalSupply();
      
      await vault.connect(user2).deposit(deposit2, user2.address);
      
      // Calculate expected shares: shares = assets * totalSupply / totalAssets
      const expectedShares = deposit2.mul(totalSupplyBefore).div(totalAssetsBefore);
      const actualShares = await vault.balanceOf(user2.address);
      
      // Allow for small rounding differences
      expect(actualShares).to.be.closeTo(expectedShares, ethers.utils.parseEther("0.01"));

      // Simulate more yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("5"));

      // Third deposit by user1 again
      const deposit3 = ethers.utils.parseEther("75");
      const totalAssetsBefore2 = await vault.totalAssets();
      const totalSupplyBefore2 = await vault.totalSupply();
      const user1SharesBefore = await vault.balanceOf(user1.address);
      
      await vault.connect(user1).deposit(deposit3, user1.address);
      
      const expectedShares2 = deposit3.mul(totalSupplyBefore2).div(totalAssetsBefore2);
      const actualNewShares = (await vault.balanceOf(user1.address)).sub(user1SharesBefore);
      
      expect(actualNewShares).to.be.closeTo(expectedShares2, ethers.utils.parseEther("0.01"));
    });

    it("should only award XP on explicit claim actions, not per block", async function () {
      // Feature: yieldquest, Property 14: XP Only From Realized Yield
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);
      await vault.connect(user2).deposit(INITIAL_DEPOSIT, user2.address);

      // Simulate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("20"));

      // Check XP before any claims
      expect(await xpManager.getXP(user1.address)).to.equal(0);
      expect(await xpManager.getXP(user2.address)).to.equal(0);

      // Mine some blocks without claiming
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      // XP should still be zero
      expect(await xpManager.getXP(user1.address)).to.equal(0);
      expect(await xpManager.getXP(user2.address)).to.equal(0);

      // Claim yield
      await vault.connect(user1).claimYield();

      // Now user1 should have XP, but user2 still shouldn't
      expect(await xpManager.getXP(user1.address)).to.be.gt(0);
      expect(await xpManager.getXP(user2.address)).to.equal(0);
    });
  });

  describe("Integration Tests", function () {
    it("should complete full flow: deposit → yield → claim → XP → level", async function () {
      // Deposit
      await vault.connect(user1).deposit(INITIAL_DEPOSIT, user1.address);

      // Simulate yield
      const yieldAmount = ethers.utils.parseEther("2"); // 2 tokens = 200 XP
      await asset.connect(owner).mint(vault.address, yieldAmount);

      // Claim yield
      await vault.connect(user1).claimYield();

      // Check XP was awarded
      const userXP = await xpManager.getXP(user1.address);
      expect(userXP).to.be.gt(0);

      // Check level (200 XP should be level 2)
      const userLevel = await xpManager.getLevel(user1.address);
      expect(userLevel).to.equal(2);
    });

    it("should handle multiple users with different deposit amounts and yield", async function () {
      // User1 deposits more
      await vault.connect(user1).deposit(ethers.utils.parseEther("200"), user1.address);
      
      // User2 deposits less
      await vault.connect(user2).deposit(ethers.utils.parseEther("100"), user2.address);

      // Simulate yield
      await asset.connect(owner).mint(vault.address, ethers.utils.parseEther("30"));

      // Both claim
      await vault.connect(user1).claimYield();
      await vault.connect(user2).claimYield();

      // User1 should have more XP (deposited more, so more yield)
      const xp1 = await xpManager.getXP(user1.address);
      const xp2 = await xpManager.getXP(user2.address);
      
      expect(xp1).to.be.gt(xp2);
    });
  });
});
