# Implementation Plan: YieldQuest Rebuild

## Overview

This implementation plan breaks down the YieldQuest smart contract rebuild into discrete, incremental tasks. Each task builds on previous work and ends with testable, integrated code. The plan follows the deployment order: BadgeNFT → XPManager → QuestVault → LeaderboardSnapshot.

**Technology Stack**: Solidity 0.8.20+, Hardhat 2.x, OpenZeppelin 5.x, Mantle Sepolia, Chai/Mocha for testing

## Tasks

- [x] 1. Project Setup and Configuration
  - Initialize Hardhat project with TypeScript
  - Configure hardhat.config.ts for Mantle Sepolia network
  - Install dependencies: @openzeppelin/contracts, @nomicfoundation/hardhat-toolbox
  - Create directory structure: contracts/, test/, scripts/, deploy/
  - Set up .env.example with PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
  - Configure TypeScript and Chai for testing
  - _Requirements: All contracts_

- [x] 2. Implement BadgeNFT Contract
  - [x] 2.1 Create BadgeNFT base contract with ERC721
    - Inherit from OpenZeppelin ERC721
    - Add badge type constants (EARLY_ADOPTER, FIRST_DEPOSIT, LEVEL_5, LEVEL_10, YIELD_MASTER)
    - Implement hasBadge mapping and userBadges array
    - Add xpManager and owner state variables
    - _Requirements: 5.1, 5.5_

  - [x] 2.2 Implement soulbound transfer restrictions
    - Override transferFrom to always revert with SoulboundTransferProhibited
    - Override safeTransferFrom to always revert
    - Override approve to always revert
    - Override setApprovalForAll to always revert
    - _Requirements: 5.3_

  - [x] 2.3 Implement badge minting logic
    - Add mint(address to, uint256 badgeType) function with onlyXPManager modifier
    - Check for duplicate badges before minting (revert BadgeAlreadyOwned)
    - Update hasBadge mapping and userBadges array
    - Emit BadgeMinted event
    - _Requirements: 5.2, 5.4, 5.6_

  - [x] 2.4 Implement view functions and admin
    - Add getBadges(address user) view function
    - Add hasBadgeType(address user, uint256 badgeType) view function
    - Add setXPManager(address) onlyOwner function
    - Add setBadgeMetadata(uint256, string) onlyOwner function
    - _Requirements: 5.5, 8.3_

  - [x] 2.5 Write unit tests for BadgeNFT
    - Test soulbound transfer prohibition (all transfer functions revert)
    - Test badge uniqueness per user (duplicate minting reverts)
    - Test getBadges and hasBadgeType view functions
    - Test access control (only XPManager can mint)
    - **Validates: Requirements 5.1, 5.3, 5.6**

- [ ] 3. Checkpoint - BadgeNFT Complete
  - Ensure all BadgeNFT tests pass
  - Verify soulbound behavior works correctly
  - Ask user if questions arise

- [ ] 4. Implement XPManager Contract
  - [x] 4.1 Create XPManager base contract
    - Add state variables: userXP, userLevel, xpMultiplier, levelThresholds
    - Add questVault, badgeNFT, owner, paused state variables
    - Define custom errors (OnlyQuestVault, OnlyOwner, InvalidMultiplier)
    - Add Pausable functionality
    - _Requirements: 3.2, 3.3, 4.1, 8.2_

  - [x] 4.2 Implement XP award logic
    - Add awardXP(address user, uint256 yieldAmount) with onlyAuthorized modifier
    - Calculate XP = yieldAmount * xpMultiplier / PRECISION
    - Update userXP mapping (cumulative)
    - Emit XPEarned event
    - _Requirements: 3.1, 3.4, 3.7_

  - [x] 4.3 Implement level calculation and updates
    - Add internal _calculateLevel(uint256 xp) function
    - Update userLevel when XP crosses threshold
    - Emit LevelUp event when level increases
    - Trigger badge minting for level-based badges (Level 5, Level 10)
    - _Requirements: 4.2, 4.3_

  - [x] 4.4 Implement view functions
    - Add getXP(address user) view function
    - Add getLevel(address user) view function
    - Add getXPToNextLevel(address user) view function
    - Add getLevelThreshold(uint256 level) view function
    - _Requirements: 3.5, 4.4, 4.5, 7.3_

  - [x] 4.5 Implement admin functions
    - Add setXPMultiplier(uint256) onlyOwner
    - Add setLevelThresholds(uint256[]) onlyOwner with monotonic check
    - Add setBadgeNFT(address) onlyOwner
    - Add setQuestVault(address) onlyOwner
    - Add pause() and unpause() onlyOwner
    - _Requirements: 8.2, 8.5_

  - [x] 4.6 Write unit tests for XPManager
    - Test XP calculation determinism (XP = yield * multiplier / PRECISION)
    - Test XP accumulation monotonicity (XP only increases)
    - Test level threshold consistency (level matches XP)
    - Test access control (only QuestVault/owner can award XP)
    - Test level-up triggers badge minting
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.7, 4.1, 4.2**

- [x] 5. Checkpoint - XPManager Complete
  - Ensure all XPManager tests pass
  - Wire XPManager to BadgeNFT (setXPManager)
  - Verify XP → Level → Badge flow works
  - Ask user if questions arise

- [x] 6. Implement QuestVault Contract
  - [x] 6.1 Create QuestVault base contract with ERC4626
    - Inherit from OpenZeppelin ERC4626
    - Add depositTimestamp mapping
    - Add lastClaimedAssets mapping (stores asset-equivalent share value at last claim)
    - Add xpManager, owner, paused state variables
    - Define custom errors (ZeroDeposit, InsufficientShares, Paused)
    - _Requirements: 1.1, 1.6, 2.4_

  - [x] 6.2 Implement deposit with timestamp tracking
    - Override deposit() to add timestamp tracking
    - Initialize lastClaimedAssets on first deposit
    - Add whenNotPaused modifier
    - Add ReentrancyGuard
    - Emit Deposit event (inherited from ERC4626)
    - _Requirements: 1.1, 1.3, 1.4, 8.6_

  - [x] 6.3 Implement withdraw with XP award
    - Override withdraw() to calculate realized yield
    - Calculate yield = convertToAssets(shares) - lastClaimedAssets
    - Call xpManager.awardXP() if yield > 0
    - Update lastClaimedAssets
    - Allow withdraw even when paused (emergency exit)
    - Emit Withdraw and YieldAccrued events
    - _Requirements: 1.2, 1.3, 1.5, 2.5, 2.6, 8.7_

  - [x] 6.4 Implement claimYield function
    - Add claimYield() external function
    - Calculate realized yield without withdrawing principal
    - Call xpManager.awardXP()
    - Update lastClaimedAssets
    - Emit YieldAccrued event
    - _Requirements: 2.5, 2.6, 3.6_

  - [x] 6.5 Implement view functions
    - Add getUserYield(address user) view function
    - Ensure balanceOf, totalAssets, convertToAssets work correctly
    - _Requirements: 2.4, 7.1, 7.2_

  - [x] 6.6 Implement admin and pause functions
    - Add setXPManager(address) onlyOwner
    - Add pause() and unpause() onlyOwner
    - Ensure deposit blocked when paused, withdraw allowed
    - _Requirements: 8.1, 8.5, 8.6, 8.7_

  - [x] 6.7 Write unit tests for QuestVault
    - Test deposit-withdraw round trip (assets returned correctly)
    - Test share proportionality (ERC-4626 math)
    - Test pause behavior (deposit blocked, withdraw allowed)
    - Test XP only awarded on explicit claim/withdraw
    - Test yield calculation and YieldAccrued event
    - **Validates: Requirements 1.1, 1.2, 2.6, 3.6, 8.6, 8.7**

- [x] 7. Checkpoint - QuestVault Complete
  - Ensure all QuestVault tests pass
  - Wire QuestVault to XPManager (setQuestVault)
  - Verify full flow: deposit → yield → claim → XP → level → badge
  - Ask user if questions arise

- [ ] 8. Implement LeaderboardSnapshot Contract
  - [x] 8.1 Create LeaderboardSnapshot base contract
    - Define SnapshotEntry struct (user, xp, rank)
    - Define Snapshot struct (id, timestamp, totalUsers, entries)
    - Add snapshots mapping and snapshotCount
    - Add maxEntriesPerSnapshot, xpManager, owner state variables
    - Define custom errors (SnapshotNotFound, TooManyEntries)
    - _Requirements: 6.1, 6.2_

  - [x] 8.2 Implement createSnapshot function
    - Add createSnapshot(address[] calldata users) onlyOwner
    - Validate users array length <= maxEntriesPerSnapshot
    - Note: users array MUST be pre-sorted off-chain by XP descending
    - Pull XP values from XPManager for each user
    - Store immutable snapshot data
    - Emit SnapshotCreated event
    - _Requirements: 6.3, 6.6, 6.7, 8.4_

  - [x] 8.3 Implement view functions
    - Add getSnapshot(uint256 snapshotId) view function
    - Add getTopUsers(uint256 snapshotId, uint256 count) view function
    - Add getUserRank(uint256 snapshotId, address user) view function
    - Add getLatestSnapshotId() view function
    - _Requirements: 6.4, 6.5, 7.5_

  - [x] 8.4 Implement admin functions
    - Add setMaxEntries(uint256) onlyOwner
    - Add setXPManager(address) onlyOwner
    - _Requirements: 8.4_

  - [x] 8.5 Write unit tests for LeaderboardSnapshot
    - Test snapshot immutability (data doesn't change after creation)
    - Test leaderboard ordering (entries sorted by XP descending)
    - Test view functions return correct data
    - Test access control (only owner can create snapshots)
    - **Validates: Requirements 6.1, 6.7**

- [x] 9. Checkpoint - LeaderboardSnapshot Complete
  - Ensure all LeaderboardSnapshot tests pass
  - Wire LeaderboardSnapshot to XPManager
  - Verify snapshot creation and queries work
  - Ask user if questions arise

- [x] 10. Integration Testing
  - [x] 10.1 Write full flow integration test
    - Test: deposit → yield simulation → claimYield → XP → level up → badge → snapshot
    - Verify all events emitted correctly
    - Verify state consistency across all contracts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 10.2 Write multi-user competition test
    - Test multiple users depositing and earning XP
    - Create snapshot and verify ranking order
    - Verify leaderboard reflects correct XP values
    - _Requirements: 6.1, 6.6_

  - [x] 10.3 Write pause/unpause integration test
    - Test pause blocks deposits but allows withdrawals
    - Test XP still awarded on emergency withdraw
    - Test unpause restores normal operation
    - _Requirements: 8.5, 8.6, 8.7_

  - [x] 10.4 Write event emission tests
    - Test all contracts emit correct events with indexed parameters
    - Verify Deposit, Withdraw, YieldAccrued, XPEarned, LevelUp, BadgeMinted, SnapshotCreated
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 11. Deployment Scripts
  - [x] 11.1 Create deployment script for all contracts
    - Use Hardhat Ignition or ethers.js deployment
    - Deploy BadgeNFT first (no dependencies)
    - Deploy XPManager (set BadgeNFT address)
    - Deploy QuestVault with mock/real underlying asset
    - Deploy LeaderboardSnapshot (set XPManager address)
    - _Requirements: All contracts_

  - [x] 11.2 Create configuration script
    - Configure XPManager.setQuestVault()
    - Configure BadgeNFT.setXPManager()
    - Set level thresholds (0, 100, 350, 850, 1850, 3850, 7850, 15850, 31850, 63850)
    - Set XP multiplier (e.g., 100 = 100 XP per 1 token yield)
    - Set maxEntriesPerSnapshot (100)
    - _Requirements: 4.1, 3.2_

  - [x] 11.3 Create verification script
    - Verify all contracts on Mantle Sepolia explorer using hardhat-verify
    - Export ABIs from artifacts/ for frontend integration
    - Document deployed addresses in deployments.json
    - _Requirements: 7.1-7.6_

- [ ] 12. Final Checkpoint - MVP Complete
  - All unit tests passing (80%+ coverage)
  - All integration tests passing
  - Contracts deployed and verified on Mantle Sepolia
  - ABIs exported for frontend
  - Demo flow completable in 90 seconds
  - Ask user for final review

## Notes

- All tasks are required for comprehensive validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests validate correctness properties from the design document
- Badge minting is triggered exclusively inside XPManager during XP award or level-up checks
- The users array passed to createSnapshot MUST be pre-sorted off-chain by XP descending
- lastClaimedAssets stores the user's asset-equivalent share value at the last successful yield claim or withdrawal
- All tests are written in TypeScript under the default /test directory using Hardhat + ethers + chai
- Yield simulation in tests uses real token minting to vault (anti-mock: no fake APR functions)
