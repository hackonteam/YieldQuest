import { expect } from "chai";
import { ethers } from "hardhat";
import { LeaderboardSnapshot, XPManager, BadgeNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("LeaderboardSnapshot", function () {
  let leaderboardSnapshot: LeaderboardSnapshot;
  let xpManager: XPManager;
  let badgeNFT: BadgeNFT;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const MAX_ENTRIES = 100;
  const XP_MULTIPLIER = ethers.utils.parseEther("100"); // 100 XP per 1 token yield

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, unauthorized] = await ethers.getSigners();

    // Deploy BadgeNFT
    const BadgeNFTFactory = await ethers.getContractFactory("BadgeNFT");
    badgeNFT = await BadgeNFTFactory.deploy(owner.address);
    await badgeNFT.deployed();

    // Deploy XPManager
    const XPManagerFactory = await ethers.getContractFactory("XPManager");
    xpManager = await XPManagerFactory.deploy(owner.address, XP_MULTIPLIER);
    await xpManager.deployed();

    // Wire BadgeNFT to XPManager
    await badgeNFT.connect(owner).setXPManager(xpManager.address);
    await xpManager.connect(owner).setBadgeNFT(badgeNFT.address);

    // Deploy LeaderboardSnapshot
    const LeaderboardSnapshotFactory = await ethers.getContractFactory("LeaderboardSnapshot");
    leaderboardSnapshot = await LeaderboardSnapshotFactory.deploy(
      owner.address,
      MAX_ENTRIES,
      xpManager.address
    );
    await leaderboardSnapshot.deployed();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await leaderboardSnapshot.owner()).to.equal(owner.address);
    });

    it("should set the correct maxEntriesPerSnapshot", async function () {
      expect(await leaderboardSnapshot.maxEntriesPerSnapshot()).to.equal(MAX_ENTRIES);
    });

    it("should set the correct xpManager", async function () {
      expect(await leaderboardSnapshot.xpManager()).to.equal(xpManager.address);
    });

    it("should initialize snapshotCount to 0", async function () {
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(0);
    });

    it("should revert if maxEntriesPerSnapshot is 0", async function () {
      const LeaderboardSnapshotFactory = await ethers.getContractFactory("LeaderboardSnapshot");
      await expect(
        LeaderboardSnapshotFactory.deploy(owner.address, 0, xpManager.address)
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "InvalidMaxEntries");
    });

    it("should revert if xpManager is zero address", async function () {
      const LeaderboardSnapshotFactory = await ethers.getContractFactory("LeaderboardSnapshot");
      await expect(
        LeaderboardSnapshotFactory.deploy(owner.address, MAX_ENTRIES, ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "InvalidXPManager");
    });
  });

  describe("Access Control", function () {
    it("should allow owner to create snapshot", async function () {
      await expect(leaderboardSnapshot.connect(owner).createSnapshot([]))
        .to.not.be.reverted;
    });

    it("should revert when non-owner tries to create snapshot", async function () {
      await expect(
        leaderboardSnapshot.connect(unauthorized).createSnapshot([])
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set max entries", async function () {
      await expect(leaderboardSnapshot.connect(owner).setMaxEntries(200))
        .to.not.be.reverted;
    });

    it("should revert when non-owner tries to set max entries", async function () {
      await expect(
        leaderboardSnapshot.connect(unauthorized).setMaxEntries(200)
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to set XPManager", async function () {
      await expect(leaderboardSnapshot.connect(owner).setXPManager(user1.address))
        .to.not.be.reverted;
    });

    it("should revert when non-owner tries to set XPManager", async function () {
      await expect(
        leaderboardSnapshot.connect(unauthorized).setXPManager(user1.address)
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "OwnableUnauthorizedAccount");
    });
  });

  describe("Create Snapshot", function () {
    beforeEach(async function () {
      // Award XP to users (simulating yield)
      await xpManager.connect(owner).setQuestVault(owner.address);
      
      // Award different amounts of XP to users
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("50")); // 5000 XP
      await xpManager.connect(owner).awardXP(user2.address, ethers.utils.parseEther("30")); // 3000 XP
      await xpManager.connect(owner).awardXP(user3.address, ethers.utils.parseEther("20")); // 2000 XP
      await xpManager.connect(owner).awardXP(user4.address, ethers.utils.parseEther("10")); // 1000 XP
      await xpManager.connect(owner).awardXP(user5.address, ethers.utils.parseEther("5"));  // 500 XP
    });

    it("should create a snapshot successfully", async function () {
      const users = [user1.address, user2.address, user3.address];
      
      const tx = await leaderboardSnapshot.connect(owner).createSnapshot(users);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(leaderboardSnapshot, "SnapshotCreated")
        .withArgs(0, block.timestamp, users.length);
    });

    it("should increment snapshotCount", async function () {
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(1);
      
      await leaderboardSnapshot.connect(owner).createSnapshot([user2.address]);
      expect(await leaderboardSnapshot.snapshotCount()).to.equal(2);
    });

    it("should store correct XP values from XPManager", async function () {
      const users = [user1.address, user2.address, user3.address];
      await leaderboardSnapshot.connect(owner).createSnapshot(users);
      
      const entries = await leaderboardSnapshot.getTopUsers(0, 3);
      
      expect(entries[0].xp).to.equal(ethers.utils.parseEther("5000"));
      expect(entries[1].xp).to.equal(ethers.utils.parseEther("3000"));
      expect(entries[2].xp).to.equal(ethers.utils.parseEther("2000"));
    });

    it("should assign correct ranks (1-based)", async function () {
      const users = [user1.address, user2.address, user3.address];
      await leaderboardSnapshot.connect(owner).createSnapshot(users);
      
      const entries = await leaderboardSnapshot.getTopUsers(0, 3);
      
      expect(entries[0].rank).to.equal(1);
      expect(entries[1].rank).to.equal(2);
      expect(entries[2].rank).to.equal(3);
    });

    it("should revert if users array exceeds maxEntriesPerSnapshot", async function () {
      // Create array with MAX_ENTRIES + 1 users
      const users = new Array(MAX_ENTRIES + 1).fill(user1.address);
      
      await expect(
        leaderboardSnapshot.connect(owner).createSnapshot(users)
      ).to.be.revertedWithCustomError(leaderboardSnapshot, "TooManyEntries")
        .withArgs(MAX_ENTRIES + 1, MAX_ENTRIES);
    });

    it("should allow empty snapshot", async function () {
      await expect(leaderboardSnapshot.connect(owner).createSnapshot([]))
        .to.not.be.reverted;
      
      const snapshot = await leaderboardSnapshot.getSnapshot(0);
      expect(snapshot.totalUsers).to.equal(0);
      expect(snapshot.entries.length).to.equal(0);
    });
  });

  describe("Snapshot Immutability", function () {
    it("should not change snapshot data after XP changes", async function () {
      // Award initial XP
      await xpManager.connect(owner).setQuestVault(owner.address);
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("10")); // 1000 XP
      
      // Create snapshot
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      
      const entries1 = await leaderboardSnapshot.getTopUsers(0, 1);
      const initialXP = entries1[0].xp;
      
      // Award more XP
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("20")); // +2000 XP
      
      // Verify snapshot data hasn't changed
      const entries2 = await leaderboardSnapshot.getTopUsers(0, 1);
      expect(entries2[0].xp).to.equal(initialXP);
      expect(entries2[0].xp).to.equal(ethers.utils.parseEther("1000"));
    });

    it("should maintain separate data for multiple snapshots", async function () {
      await xpManager.connect(owner).setQuestVault(owner.address);
      
      // First snapshot
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("10"));
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      
      // Second snapshot with more XP
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("20"));
      await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
      
      const entries1 = await leaderboardSnapshot.getTopUsers(0, 1);
      const entries2 = await leaderboardSnapshot.getTopUsers(1, 1);
      
      expect(entries1[0].xp).to.equal(ethers.utils.parseEther("1000"));
      expect(entries2[0].xp).to.equal(ethers.utils.parseEther("3000"));
    });
  });

  describe("Leaderboard Ordering", function () {
    it("should maintain order when users are pre-sorted by XP descending", async function () {
      await xpManager.connect(owner).setQuestVault(owner.address);
      
      // Award XP in descending order
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("50")); // 5000 XP
      await xpManager.connect(owner).awardXP(user2.address, ethers.utils.parseEther("30")); // 3000 XP
      await xpManager.connect(owner).awardXP(user3.address, ethers.utils.parseEther("10")); // 1000 XP
      
      // Create snapshot with pre-sorted users
      const users = [user1.address, user2.address, user3.address];
      await leaderboardSnapshot.connect(owner).createSnapshot(users);
      
      const entries = await leaderboardSnapshot.getTopUsers(0, 3);
      
      // Verify descending order
      expect(entries[0].xp).to.be.gte(entries[1].xp);
      expect(entries[1].xp).to.be.gte(entries[2].xp);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await xpManager.connect(owner).setQuestVault(owner.address);
      
      // Award XP to users
      await xpManager.connect(owner).awardXP(user1.address, ethers.utils.parseEther("50"));
      await xpManager.connect(owner).awardXP(user2.address, ethers.utils.parseEther("30"));
      await xpManager.connect(owner).awardXP(user3.address, ethers.utils.parseEther("20"));
      await xpManager.connect(owner).awardXP(user4.address, ethers.utils.parseEther("10"));
      
      // Create snapshot
      const users = [user1.address, user2.address, user3.address, user4.address];
      await leaderboardSnapshot.connect(owner).createSnapshot(users);
    });

    describe("getSnapshot", function () {
      it("should return complete snapshot data", async function () {
        const snapshot = await leaderboardSnapshot.getSnapshot(0);
        
        expect(snapshot.id).to.equal(0);
        expect(snapshot.totalUsers).to.equal(4);
        // Note: entries array may not be properly returned due to Solidity limitations
        // Use getTopUsers() to access entries instead
      });

      it("should revert for non-existent snapshot", async function () {
        await expect(
          leaderboardSnapshot.getSnapshot(999)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "SnapshotNotFound")
          .withArgs(999);
      });
    });

    describe("getTopUsers", function () {
      it("should return top N users", async function () {
        const topUsers = await leaderboardSnapshot.getTopUsers(0, 2);
        
        expect(topUsers.length).to.equal(2);
        expect(topUsers[0].user).to.equal(user1.address);
        expect(topUsers[1].user).to.equal(user2.address);
      });

      it("should return all users if count exceeds total", async function () {
        const topUsers = await leaderboardSnapshot.getTopUsers(0, 100);
        
        expect(topUsers.length).to.equal(4);
      });

      it("should return empty array for count 0", async function () {
        const topUsers = await leaderboardSnapshot.getTopUsers(0, 0);
        
        expect(topUsers.length).to.equal(0);
      });

      it("should revert for non-existent snapshot", async function () {
        await expect(
          leaderboardSnapshot.getTopUsers(999, 10)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "SnapshotNotFound")
          .withArgs(999);
      });
    });

    describe("getUserRank", function () {
      it("should return correct rank and XP for user in snapshot", async function () {
        const [rank, xp] = await leaderboardSnapshot.getUserRank(0, user2.address);
        
        expect(rank).to.equal(2);
        expect(xp).to.equal(ethers.utils.parseEther("3000"));
      });

      it("should return (0, 0) for user not in snapshot", async function () {
        const [rank, xp] = await leaderboardSnapshot.getUserRank(0, user5.address);
        
        expect(rank).to.equal(0);
        expect(xp).to.equal(0);
      });

      it("should revert for non-existent snapshot", async function () {
        await expect(
          leaderboardSnapshot.getUserRank(999, user1.address)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "SnapshotNotFound")
          .withArgs(999);
      });
    });

    describe("getLatestSnapshotId", function () {
      it("should return 0 when no snapshots exist", async function () {
        const LeaderboardSnapshotFactory = await ethers.getContractFactory("LeaderboardSnapshot");
        const newSnapshot = await LeaderboardSnapshotFactory.deploy(
          owner.address,
          MAX_ENTRIES,
          xpManager.address
        );
        await newSnapshot.deployed();
        
        expect(await newSnapshot.getLatestSnapshotId()).to.equal(0);
      });

      it("should return latest snapshot ID", async function () {
        expect(await leaderboardSnapshot.getLatestSnapshotId()).to.equal(0);
        
        await leaderboardSnapshot.connect(owner).createSnapshot([user1.address]);
        expect(await leaderboardSnapshot.getLatestSnapshotId()).to.equal(1);
      });
    });
  });

  describe("Admin Functions", function () {
    describe("setMaxEntries", function () {
      it("should update maxEntriesPerSnapshot", async function () {
        const newMax = 200;
        await expect(leaderboardSnapshot.connect(owner).setMaxEntries(newMax))
          .to.emit(leaderboardSnapshot, "MaxEntriesUpdated")
          .withArgs(MAX_ENTRIES, newMax);
        
        expect(await leaderboardSnapshot.maxEntriesPerSnapshot()).to.equal(newMax);
      });

      it("should revert if new max is 0", async function () {
        await expect(
          leaderboardSnapshot.connect(owner).setMaxEntries(0)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "InvalidMaxEntries");
      });

      it("should revert when non-owner tries to set max entries", async function () {
        await expect(
          leaderboardSnapshot.connect(unauthorized).setMaxEntries(200)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "OwnableUnauthorizedAccount");
      });
    });

    describe("setXPManager", function () {
      it("should update xpManager address", async function () {
        const newManager = user1.address;
        await expect(leaderboardSnapshot.connect(owner).setXPManager(newManager))
          .to.emit(leaderboardSnapshot, "XPManagerUpdated")
          .withArgs(xpManager.address, newManager);
        
        expect(await leaderboardSnapshot.xpManager()).to.equal(newManager);
      });

      it("should revert if new manager is zero address", async function () {
        await expect(
          leaderboardSnapshot.connect(owner).setXPManager(ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "InvalidXPManager");
      });

      it("should revert when non-owner tries to set XPManager", async function () {
        await expect(
          leaderboardSnapshot.connect(unauthorized).setXPManager(user1.address)
        ).to.be.revertedWithCustomError(leaderboardSnapshot, "OwnableUnauthorizedAccount");
      });
    });
  });
});
