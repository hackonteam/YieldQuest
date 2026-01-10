// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSDC
 * @notice Test USDC token for YieldQuest testnet deployment
 * @dev ERC20 token with 18 decimals, pegged to USD for testing purposes
 */
contract TestUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**DECIMALS; // 100 million tokens

    /**
     * @notice Constructor
     * @param initialOwner Address of the contract owner
     */
    constructor(address initialOwner) ERC20("Test USDC", "testUSDC") Ownable(initialOwner) {
        // Mint initial supply to the owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @notice Returns the number of decimals used by the token
     * @return Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint additional tokens (only owner)
     * @dev Allows owner to mint more tokens for testing purposes
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
