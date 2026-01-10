import { expect } from "chai";
import { ethers } from "hardhat";
import { BadgeNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("BadgeNFT", function () {
  let badgeNFT: BadgeNFT;
  let owner: SignerWithAddress;
  let xpManager: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // Badge type constants
  const BADGE_EARLY_ADOPTER = 1;
  const BADGE_FIRST_DEPOSIT = 2;
  const BADGE_LEVEL_5 = 3;
  const BADGE_LEVEL_10 = 4;
  const BADGE_YIELD_MASTER = 5;

  beforeEach(async function () {
    [owner, xpManager, user1, user2, unauthorized] = await ethers.getSigners();

    const BadgeNFTFactory = await ethers.getContractFactory("BadgeNFT");
    badgeNFT = await BadgeNFTFactory.deploy(owner.address);
    await badgeNFT.deployed();

    // Set XPManager
    await badgeNFT.connect(owner).setXPManager(xpManager.address);
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await badgeNFT.owner()).to.equal(owner.address);
    });

    it("should set the correct name and symbol", async function () {
      expect(await badgeNFT.name()).to.equal("YieldQuest Badge");
      expect(await badgeNFT.symbol()).to.equal("YQBADGE");
    });

    it("should have correct badge type constants", async function () {
      expect(await badgeNFT.BADGE_EARLY_ADOPTER()).to.equal(BADGE_EARLY_ADOPTER);
      expect(await badgeNFT.BADGE_FIRST_DEPOSIT()).to.equal(BADGE_FIRST_DEPOSIT);
      expect(await badgeNFT.BADGE_LEVEL_5()).to.equal(BADGE_LEVEL_5);
      expect(await badgeNFT.BADGE_LEVEL_10()).to.equal(BADGE_LEVEL_10);
      expect(await badgeNFT.BADGE_YIELD_MASTER()).to.equal(BADGE_YIELD_MASTER);
    });
  });

  describe("Access Control", function () {
    it("should allow XPManager to mint badges", async function () {
      await expect(badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT))
        .to.not.be.reverted;
    });

    it("should allow owner to mint badges", async function () {
      await expect(badgeNFT.connect(owner).mint(user1.address, BADGE_FIRST_DEPOSIT))
        .to.not.be.reverted;
    });

    it("should revert when unauthorized address tries to mint", async function () {
      await expect(
        badgeNFT.connect(unauthorized).mint(user1.address, BADGE_FIRST_DEPOSIT)
      ).to.be.revertedWithCustomError(badgeNFT, "OnlyXPManager");
    });

    it("should allow owner to set XPManager", async function () {
      const newXPManager = user2.address;
      await expect(badgeNFT.connect(owner).setXPManager(newXPManager))
        .to.emit(badgeNFT, "XPManagerUpdated")
        .withArgs(xpManager.address, newXPManager);
      
      expect(await badgeNFT.xpManager()).to.equal(newXPManager);
    });

    it("should revert when non-owner tries to set XPManager", async function () {
      await expect(
        badgeNFT.connect(unauthorized).setXPManager(user2.address)
      ).to.be.revertedWithCustomError(badgeNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Badge Minting", function () {
    it("should mint a badge successfully", async function () {
      const tx = await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(badgeNFT, "BadgeMinted")
        .withArgs(user1.address, BADGE_FIRST_DEPOSIT, 1, block.timestamp);
    });

    it("should update hasBadge mapping correctly", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      
      expect(await badgeNFT.hasBadge(user1.address, BADGE_FIRST_DEPOSIT)).to.be.true;
      expect(await badgeNFT.hasBadge(user1.address, BADGE_LEVEL_5)).to.be.false;
    });

    it("should add badge to userBadges array", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_LEVEL_5);
      
      const badges = await badgeNFT.getBadges(user1.address);
      expect(badges.length).to.equal(2);
      expect(badges[0]).to.equal(BADGE_FIRST_DEPOSIT);
      expect(badges[1]).to.equal(BADGE_LEVEL_5);
    });

    it("should increment token IDs correctly", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      await badgeNFT.connect(xpManager).mint(user2.address, BADGE_FIRST_DEPOSIT);
      
      expect(await badgeNFT.ownerOf(1)).to.equal(user1.address);
      expect(await badgeNFT.ownerOf(2)).to.equal(user2.address);
    });
  });

  describe("Badge Uniqueness", function () {
    it("should revert when minting duplicate badge to same user", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      
      await expect(
        badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT)
      ).to.be.revertedWithCustomError(badgeNFT, "BadgeAlreadyOwned")
        .withArgs(user1.address, BADGE_FIRST_DEPOSIT);
    });

    it("should allow same badge type to different users", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      await expect(badgeNFT.connect(xpManager).mint(user2.address, BADGE_FIRST_DEPOSIT))
        .to.not.be.reverted;
    });

    it("should allow different badge types to same user", async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      await expect(badgeNFT.connect(xpManager).mint(user1.address, BADGE_LEVEL_5))
        .to.not.be.reverted;
    });
  });

  describe("Soulbound Transfer Restrictions", function () {
    beforeEach(async function () {
      // Mint a badge to user1
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
    });

    it("should revert on transferFrom", async function () {
      await expect(
        badgeNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWithCustomError(badgeNFT, "SoulboundTransferProhibited");
    });

    it("should revert on safeTransferFrom", async function () {
      await expect(
        badgeNFT.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        )
      ).to.be.revertedWithCustomError(badgeNFT, "SoulboundTransferProhibited");
    });

    it("should revert on safeTransferFrom with data", async function () {
      await expect(
        badgeNFT.connect(user1)["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          1,
          "0x"
        )
      ).to.be.revertedWithCustomError(badgeNFT, "SoulboundTransferProhibited");
    });

    it("should revert on approve", async function () {
      await expect(
        badgeNFT.connect(user1).approve(user2.address, 1)
      ).to.be.revertedWithCustomError(badgeNFT, "SoulboundTransferProhibited");
    });

    it("should revert on setApprovalForAll", async function () {
      await expect(
        badgeNFT.connect(user1).setApprovalForAll(user2.address, true)
      ).to.be.revertedWithCustomError(badgeNFT, "SoulboundTransferProhibited");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_FIRST_DEPOSIT);
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_LEVEL_5);
      await badgeNFT.connect(xpManager).mint(user1.address, BADGE_LEVEL_10);
    });

    it("should return all badges for a user", async function () {
      const badges = await badgeNFT.getBadges(user1.address);
      expect(badges.length).to.equal(3);
      expect(badges[0]).to.equal(BADGE_FIRST_DEPOSIT);
      expect(badges[1]).to.equal(BADGE_LEVEL_5);
      expect(badges[2]).to.equal(BADGE_LEVEL_10);
    });

    it("should return empty array for user with no badges", async function () {
      const badges = await badgeNFT.getBadges(user2.address);
      expect(badges.length).to.equal(0);
    });

    it("should correctly check if user has specific badge type", async function () {
      expect(await badgeNFT.hasBadgeType(user1.address, BADGE_FIRST_DEPOSIT)).to.be.true;
      expect(await badgeNFT.hasBadgeType(user1.address, BADGE_LEVEL_5)).to.be.true;
      expect(await badgeNFT.hasBadgeType(user1.address, BADGE_YIELD_MASTER)).to.be.false;
      expect(await badgeNFT.hasBadgeType(user2.address, BADGE_FIRST_DEPOSIT)).to.be.false;
    });
  });

  describe("Badge Metadata", function () {
    it("should allow owner to set badge metadata", async function () {
      const uri = "ipfs://QmTest123";
      await expect(badgeNFT.connect(owner).setBadgeMetadata(BADGE_FIRST_DEPOSIT, uri))
        .to.emit(badgeNFT, "BadgeMetadataUpdated")
        .withArgs(BADGE_FIRST_DEPOSIT, uri);
      
      expect(await badgeNFT.badgeMetadata(BADGE_FIRST_DEPOSIT)).to.equal(uri);
    });

    it("should revert when non-owner tries to set metadata", async function () {
      await expect(
        badgeNFT.connect(unauthorized).setBadgeMetadata(BADGE_FIRST_DEPOSIT, "ipfs://test")
      ).to.be.revertedWithCustomError(badgeNFT, "OwnableUnauthorizedAccount");
    });
  });
});
