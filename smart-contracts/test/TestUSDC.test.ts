import { expect } from "chai";
import { ethers } from "hardhat";
import { TestUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("TestUSDC", function () {
  let testUSDC: TestUSDC;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.utils.parseEther("100000000"); // 100 million tokens

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy TestUSDC
    const TestUSDCFactory = await ethers.getContractFactory("TestUSDC");
    testUSDC = await TestUSDCFactory.deploy(owner.address);
    await testUSDC.deployed();
  });

  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      expect(await testUSDC.name()).to.equal("Test USDC");
      expect(await testUSDC.symbol()).to.equal("testUSDC");
    });

    it("should have 18 decimals", async function () {
      expect(await testUSDC.decimals()).to.equal(18);
    });

    it("should mint initial supply to owner", async function () {
      expect(await testUSDC.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("should have correct total supply", async function () {
      expect(await testUSDC.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("should set the correct owner", async function () {
      expect(await testUSDC.owner()).to.equal(owner.address);
    });
  });

  describe("Transfers", function () {
    it("should transfer tokens between accounts", async function () {
      const transferAmount = ethers.utils.parseEther("1000");

      await testUSDC.connect(owner).transfer(user1.address, transferAmount);
      expect(await testUSDC.balanceOf(user1.address)).to.equal(transferAmount);

      await testUSDC.connect(user1).transfer(user2.address, transferAmount);
      expect(await testUSDC.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await testUSDC.balanceOf(user1.address)).to.equal(0);
    });

    it("should emit Transfer event", async function () {
      const transferAmount = ethers.utils.parseEther("1000");

      await expect(testUSDC.connect(owner).transfer(user1.address, transferAmount))
        .to.emit(testUSDC, "Transfer")
        .withArgs(owner.address, user1.address, transferAmount);
    });

    it("should revert when transferring more than balance", async function () {
      const transferAmount = ethers.utils.parseEther("1000");

      await expect(
        testUSDC.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWithCustomError(testUSDC, "ERC20InsufficientBalance");
    });
  });

  describe("Allowance and TransferFrom", function () {
    it("should approve and transferFrom", async function () {
      const approveAmount = ethers.utils.parseEther("1000");
      const transferAmount = ethers.utils.parseEther("500");

      await testUSDC.connect(owner).approve(user1.address, approveAmount);
      expect(await testUSDC.allowance(owner.address, user1.address)).to.equal(approveAmount);

      await testUSDC.connect(user1).transferFrom(owner.address, user2.address, transferAmount);
      expect(await testUSDC.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await testUSDC.allowance(owner.address, user1.address)).to.equal(
        approveAmount.sub(transferAmount)
      );
    });

    it("should emit Approval event", async function () {
      const approveAmount = ethers.utils.parseEther("1000");

      await expect(testUSDC.connect(owner).approve(user1.address, approveAmount))
        .to.emit(testUSDC, "Approval")
        .withArgs(owner.address, user1.address, approveAmount);
    });
  });

  describe("Minting", function () {
    it("should allow owner to mint additional tokens", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");
      const initialSupply = await testUSDC.totalSupply();

      await testUSDC.connect(owner).mint(user1.address, mintAmount);

      expect(await testUSDC.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await testUSDC.totalSupply()).to.equal(initialSupply.add(mintAmount));
    });

    it("should emit Transfer event on mint", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");

      await expect(testUSDC.connect(owner).mint(user1.address, mintAmount))
        .to.emit(testUSDC, "Transfer")
        .withArgs(ethers.constants.AddressZero, user1.address, mintAmount);
    });

    it("should revert when non-owner tries to mint", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");

      await expect(
        testUSDC.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(testUSDC, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("should allow users to burn their tokens", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      const burnAmount = ethers.utils.parseEther("500");

      await testUSDC.connect(owner).transfer(user1.address, transferAmount);
      const initialSupply = await testUSDC.totalSupply();

      await testUSDC.connect(user1).burn(burnAmount);

      expect(await testUSDC.balanceOf(user1.address)).to.equal(transferAmount.sub(burnAmount));
      expect(await testUSDC.totalSupply()).to.equal(initialSupply.sub(burnAmount));
    });

    it("should emit Transfer event on burn", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      const burnAmount = ethers.utils.parseEther("500");

      await testUSDC.connect(owner).transfer(user1.address, transferAmount);

      await expect(testUSDC.connect(user1).burn(burnAmount))
        .to.emit(testUSDC, "Transfer")
        .withArgs(user1.address, ethers.constants.AddressZero, burnAmount);
    });

    it("should revert when burning more than balance", async function () {
      const burnAmount = ethers.utils.parseEther("1000");

      await expect(
        testUSDC.connect(user1).burn(burnAmount)
      ).to.be.revertedWithCustomError(testUSDC, "ERC20InsufficientBalance");
    });
  });

  describe("Large Amounts", function () {
    it("should handle 100 million token supply correctly", async function () {
      const expectedSupply = ethers.utils.parseEther("100000000");
      expect(await testUSDC.totalSupply()).to.equal(expectedSupply);
      expect(await testUSDC.balanceOf(owner.address)).to.equal(expectedSupply);
    });

    it("should transfer large amounts correctly", async function () {
      const largeAmount = ethers.utils.parseEther("50000000"); // 50 million

      await testUSDC.connect(owner).transfer(user1.address, largeAmount);
      expect(await testUSDC.balanceOf(user1.address)).to.equal(largeAmount);
      expect(await testUSDC.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY.sub(largeAmount)
      );
    });
  });
});
