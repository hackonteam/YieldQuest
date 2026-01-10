import { expect } from "chai";
import { ethers } from "hardhat";
import { XPManager, BadgeNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("XPManager", function () {
  let xpManager: XPManager;
  let badgeNFT: BadgeNFT;
  let owner: SignerWithAddress;
  let questVault: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const PRECISION = ethers.utils.parseEther("1"); // 1e18
  const DEFAULT_MULTIPLIER = ethers.BigNumber.from(100).mul(PRECISION); // 100 * 1e18

  beforeEach(async function () {
    [owner, questVault, user1, user2, unauthorized] = await ethers.getSigners();

    // Deploy BadgeNFT
    const BadgeNFTFactory = await ethers.getContractFactory("BadgeNFT");
    badgeNFT = await BadgeNFTFactory.deploy(owner.address);
    await badgeNFT.deployed();

    // Deploy XPManager
    const XPManagerFactory = await ethers.getContractFactory("XPManager");
    xpManager = await XPManagerFactory.deploy(owner.address, DEFAULT_MULTIPLIER);
    await xpManager.deployed();

    // Configure contracts
    await xpManager.connect(owner).setQuestVault(questVault.address);
    await xpManager.connect(owner).setBadgeNFT(badgeNFT.address);
    await badgeNFT.connect(owner).setXPManager(xpManager.address);
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await xpManager.owner()).to.equal(owner.address);
    });

    it("should set the correct XP multiplier", async function () {
      expect(await xpManager.xpMultiplier()).to.equal(DEFAULT_MULTIPLIER);
    });

    it("should initialize default level thresholds", async function () {
      expect(await xpManager.getLevelThreshold(1)).to.equal(0);
      expect(await xpManager.getLevelThreshold(2)).to.equal(ethers.BigNumber.from(100).mul(PRECISION));
      expect(await xpManager.getLevelThreshold(5)).to.equal(ethers.BigNumber.from(1850).mul(PRECISION));
      expect(await xpManager.getLevelThreshold(10)).to.equal(ethers.BigNumber.from(63850).mul(PRECISION));
    });

    it("should revert if multiplier is zero", async function () {
      const XPManagerFactory = await ethers.getContractFactory("XPManager");
      await expect(
        XPManagerFactory.deploy(owner.address, 0)
      ).to.be.revertedWithCustomError(xpManager, "InvalidMultiplier");
    });
  });

  describe("XP Award Logic", function () {
    it("should calculate XP deterministically (XP = yield * multiplier / PRECISION)", async function () {
      // Feature: yieldquest, Property 3: XP Calculation Determinism
      const yieldAmount = ethers.utils.parseEther("10"); // 10 tokens
      const expectedXP = yieldAmount.mul(DEFAULT_MULTIPLIER).div(PRECISION);

      await xpManager.connect(questVault).awardXP(user1.address, yieldAmount);

      expect(await xpManager.getXP(user1.address)).to.equal(expectedXP);
      // 10 * 100 = 1000 XP
    });

    it("should accumulate XP correctly over multiple awards", async function () {
      const yield1 = ethers.utils.parseEther("5");
      const yield2 = ethers.utils.parseEther("3");
      const yield3 = ethers.utils.parseEther("2");

      await xpManager.connect(questVault).awardXP(user1.address, yield1);
      await xpManager.connect(questVault).awardXP(user1.address, yield2);
      await xpManager.connect(questVault).awardXP(user1.address, yield3);

      const totalYield = yield1.add(yield2).add(yield3);
      const expectedXP = totalYield.mul(DEFAULT_MULTIPLIER).div(PRECISION);

      expect(await xpManager.getXP(user1.address)).to.equal(expectedXP);
      // (5 + 3 + 2) * 100 = 1000 XP
    });

    it("should only increase XP (monotonic)", async function () {
      // Feature: yieldquest, Property 4: XP Accumulation Monotonicity
      const yields = [
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("3"),
      ];

      let previousXP = ethers.BigNumber.from(0);

      for (const yieldAmount of yields) {
        await xpManager.connect(questVault).awardXP(user1.address, yieldAmount);
        const currentXP = await xpManager.getXP(user1.address);
        expect(currentXP).to.be.gte(previousXP);
        previousXP = currentXP;
      }
    });

    it("should emit XPEarned event with correct parameters", async function () {
      const yieldAmount = ethers.utils.parseEther("5");
      const expectedXP = yieldAmount.mul(DEFAULT_MULTIPLIER).div(PRECISION);

      await expect(xpManager.connect(questVault).awardXP(user1.address, yieldAmount))
        .to.emit(xpManager, "XPEarned")
        .withArgs(user1.address, yieldAmount, expectedXP, expectedXP);
    });

    it("should revert when called by unauthorized address", async function () {
      // Feature: yieldquest, Property 10: Access Control Enforcement
      const yieldAmount = ethers.utils.parseEther("5");

      await expect(
        xpManager.connect(unauthorized).awardXP(user1.address, yieldAmount)
      ).to.be.revertedWithCustomError(xpManager, "Unauthorized");
    });

    it("should allow owner to award XP", async function () {
      const yieldAmount = ethers.utils.parseEther("5");
      const expectedXP = yieldAmount.mul(DEFAULT_MULTIPLIER).div(PRECISION);

      await xpManager.connect(owner).awardXP(user1.address, yieldAmount);

      expect(await xpManager.getXP(user1.address)).to.equal(expectedXP);
    });

    it("should revert when paused", async function () {
      await xpManager.connect(owner).pause();

      const yieldAmount = ethers.utils.parseEther("5");

      await expect(
        xpManager.connect(questVault).awardXP(user1.address, yieldAmount)
      ).to.be.revertedWithCustomError(xpManager, "EnforcedPause");
    });
  });

  describe("Level Calculation and Updates", function () {
    it("should calculate level correctly based on XP", async function () {
      // Feature: yieldquest, Property 5: Level Threshold Consistency
      // Level 1: 0 XP
      expect(await xpManager.getLevel(user1.address)).to.equal(1);

      // Award 1 ether yield = 100 XP -> Level 2
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("1"));
      expect(await xpManager.getLevel(user1.address)).to.equal(2);

      // Award 2.5 ether yield = 250 more XP (total 350) -> Level 3
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("2.5"));
      expect(await xpManager.getLevel(user1.address)).to.equal(3);

      // Award 5 ether yield = 500 more XP (total 850) -> Level 4
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("5"));
      expect(await xpManager.getLevel(user1.address)).to.equal(4);
    });

    it("should emit LevelUp event when level increases", async function () {
      // Award 1 ether yield = 100 XP to reach level 2
      const yieldAmount = ethers.utils.parseEther("1");
      const expectedXP = yieldAmount.mul(DEFAULT_MULTIPLIER).div(PRECISION);

      await expect(xpManager.connect(questVault).awardXP(user1.address, yieldAmount))
        .to.emit(xpManager, "LevelUp")
        .withArgs(user1.address, 2, expectedXP);
    });

    it("should not emit LevelUp event when level stays the same", async function () {
      // Award 0.5 ether yield = 50 XP (stays at level 1)
      const yieldAmount = ethers.utils.parseEther("0.5");

      const tx = await xpManager.connect(questVault).awardXP(user1.address, yieldAmount);
      const receipt = await tx.wait();

      const levelUpEvents = receipt.events?.filter((e) => e.event === "LevelUp");
      expect(levelUpEvents?.length || 0).to.equal(0);
    });

    it("should trigger badge minting when reaching level 5", async function () {
      // Award enough yield to reach level 5 (1850 XP = 18.5 ether yield)
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("18.5"));

      expect(await xpManager.getLevel(user1.address)).to.equal(5);
      expect(await badgeNFT.hasBadgeType(user1.address, 3)).to.be.true; // BADGE_LEVEL_5 = 3
    });

    it("should trigger badge minting when reaching level 10", async function () {
      // Award enough XP to reach level 10 (63850 XP)
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("638.5"));

      expect(await xpManager.getLevel(user1.address)).to.equal(10);
      expect(await badgeNFT.hasBadgeType(user1.address, 4)).to.be.true; // BADGE_LEVEL_10 = 4
    });

    it("should mint both level 5 and level 10 badges when jumping from level 1 to 10", async function () {
      // Award enough XP to jump directly to level 10
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("638.5"));

      expect(await xpManager.getLevel(user1.address)).to.equal(10);
      expect(await badgeNFT.hasBadgeType(user1.address, 3)).to.be.true; // BADGE_LEVEL_5
      expect(await badgeNFT.hasBadgeType(user1.address, 4)).to.be.true; // BADGE_LEVEL_10
    });
  });

  describe("View Functions", function () {
    it("should return correct XP for user", async function () {
      const yieldAmount = ethers.utils.parseEther("5");
      const expectedXP = yieldAmount.mul(DEFAULT_MULTIPLIER).div(PRECISION);
      
      await xpManager.connect(questVault).awardXP(user1.address, yieldAmount);
      expect(await xpManager.getXP(user1.address)).to.equal(expectedXP);
    });

    it("should return correct level for user", async function () {
      // Award 3.5 ether yield = 350 XP -> Level 3
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("3.5"));
      expect(await xpManager.getLevel(user1.address)).to.equal(3);
    });

    it("should return correct XP to next level", async function () {
      // User has 200 XP (level 2), needs 350 for level 3
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("2"));
      const xpToNext = await xpManager.getXPToNextLevel(user1.address);
      const currentXP = ethers.BigNumber.from(200).mul(PRECISION);
      const nextThreshold = ethers.BigNumber.from(350).mul(PRECISION);
      const expectedXP = nextThreshold.sub(currentXP);
      expect(xpToNext).to.equal(expectedXP);
    });

    it("should return 0 XP to next level when at max level", async function () {
      // Award enough XP to reach level 10
      await xpManager.connect(questVault).awardXP(user1.address, ethers.utils.parseEther("638.5"));
      expect(await xpManager.getXPToNextLevel(user1.address)).to.equal(0);
    });

    it("should return correct level threshold", async function () {
      expect(await xpManager.getLevelThreshold(1)).to.equal(0);
      expect(await xpManager.getLevelThreshold(5)).to.equal(ethers.BigNumber.from(1850).mul(PRECISION));
      expect(await xpManager.getLevelThreshold(10)).to.equal(ethers.BigNumber.from(63850).mul(PRECISION));
    });

    it("should return 0 for invalid level threshold queries", async function () {
      expect(await xpManager.getLevelThreshold(0)).to.equal(0);
      expect(await xpManager.getLevelThreshold(11)).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set XP multiplier", async function () {
      const newMultiplier = ethers.utils.parseEther("200");

      await expect(xpManager.connect(owner).setXPMultiplier(newMultiplier))
        .to.emit(xpManager, "XPMultiplierUpdated")
        .withArgs(DEFAULT_MULTIPLIER, newMultiplier);

      expect(await xpManager.xpMultiplier()).to.equal(newMultiplier);
    });

    it("should revert when setting zero multiplier", async function () {
      await expect(
        xpManager.connect(owner).setXPMultiplier(0)
      ).to.be.revertedWithCustomError(xpManager, "InvalidMultiplier");
    });

    it("should allow owner to set level thresholds", async function () {
      const newThresholds = [
        0,
        ethers.BigNumber.from(50).mul(PRECISION),
        ethers.BigNumber.from(150).mul(PRECISION),
        ethers.BigNumber.from(300).mul(PRECISION),
        ethers.BigNumber.from(500).mul(PRECISION)
      ];

      await xpManager.connect(owner).setLevelThresholds(newThresholds);

      expect(await xpManager.getLevelThreshold(1)).to.equal(0);
      expect(await xpManager.getLevelThreshold(2)).to.equal(ethers.BigNumber.from(50).mul(PRECISION));
      expect(await xpManager.getLevelThreshold(5)).to.equal(ethers.BigNumber.from(500).mul(PRECISION));
    });

    it("should revert when setting non-monotonic thresholds", async function () {
      const invalidThresholds = [0, 100, 90, 200]; // 90 < 100

      await expect(
        xpManager.connect(owner).setLevelThresholds(invalidThresholds)
      ).to.be.revertedWithCustomError(xpManager, "InvalidThresholds");
    });

    it("should revert when first threshold is not zero", async function () {
      const invalidThresholds = [10, 100, 200];

      await expect(
        xpManager.connect(owner).setLevelThresholds(invalidThresholds)
      ).to.be.revertedWithCustomError(xpManager, "InvalidThresholds");
    });

    it("should revert when setting empty thresholds", async function () {
      await expect(
        xpManager.connect(owner).setLevelThresholds([])
      ).to.be.revertedWithCustomError(xpManager, "InvalidThresholds");
    });

    it("should allow owner to set BadgeNFT address", async function () {
      const newBadgeNFT = user2.address;

      await expect(xpManager.connect(owner).setBadgeNFT(newBadgeNFT))
        .to.emit(xpManager, "BadgeNFTUpdated")
        .withArgs(badgeNFT.address, newBadgeNFT);

      expect(await xpManager.badgeNFT()).to.equal(newBadgeNFT);
    });

    it("should allow owner to set QuestVault address", async function () {
      const newVault = user2.address;

      await expect(xpManager.connect(owner).setQuestVault(newVault))
        .to.emit(xpManager, "QuestVaultUpdated")
        .withArgs(questVault.address, newVault);

      expect(await xpManager.questVault()).to.equal(newVault);
    });

    it("should allow owner to pause and unpause", async function () {
      await xpManager.connect(owner).pause();
      expect(await xpManager.paused()).to.be.true;

      await xpManager.connect(owner).unpause();
      expect(await xpManager.paused()).to.be.false;
    });

    it("should revert when non-owner tries to set multiplier", async function () {
      await expect(
        xpManager.connect(unauthorized).setXPMultiplier(ethers.utils.parseEther("200"))
      ).to.be.revertedWithCustomError(xpManager, "OwnableUnauthorizedAccount");
    });

    it("should revert when non-owner tries to pause", async function () {
      await expect(
        xpManager.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(xpManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Property Tests - Multiple Users", function () {
    it("should maintain XP monotonicity across multiple users and awards", async function () {
      // Feature: yieldquest, Property 4: XP Accumulation Monotonicity
      const users = [user1, user2];
      const previousXP: { [key: string]: any } = {};

      for (let i = 0; i < 20; i++) {
        const user = users[i % users.length];
        const randomYield = ethers.utils.parseEther((Math.random() * 10 + 0.1).toFixed(2));

        if (!previousXP[user.address]) {
          previousXP[user.address] = ethers.BigNumber.from(0);
        }

        await xpManager.connect(questVault).awardXP(user.address, randomYield);
        const currentXP = await xpManager.getXP(user.address);

        expect(currentXP).to.be.gte(previousXP[user.address]);
        previousXP[user.address] = currentXP;
      }
    });

    it("should maintain level consistency with XP across multiple users", async function () {
      // Feature: yieldquest, Property 5: Level Threshold Consistency
      const users = [user1, user2];

      for (const user of users) {
        // Award random XP amounts
        for (let i = 0; i < 5; i++) {
          const randomYield = ethers.utils.parseEther((Math.random() * 20 + 1).toFixed(2));
          await xpManager.connect(questVault).awardXP(user.address, randomYield);
        }

        const xp = await xpManager.getXP(user.address);
        const level = await xpManager.getLevel(user.address);
        const threshold = await xpManager.getLevelThreshold(level);

        // XP should be >= current level threshold
        expect(xp).to.be.gte(threshold);

        // If not at max level, XP should be < next level threshold
        const maxLevel = 10;
        if (level < maxLevel) {
          const nextThreshold = await xpManager.getLevelThreshold(level + 1);
          // Only check if nextThreshold is valid (not 0 for non-existent levels)
          if (nextThreshold.gt(0)) {
            expect(xp).to.be.lt(nextThreshold);
          }
        }
      }
    });
  });
});
