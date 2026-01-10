# Requirements Document

## Introduction

YieldQuest is a GameFi × Social × DeFi protocol on Mantle Network that transforms real DeFi yield into a social, competitive game experience. Users earn progress, reputation, and on-chain achievements through actual yield generation—not fake APR or inflationary rewards.

This document defines the MVP requirements for rebuilding YieldQuest from scratch, targeting hackathon-grade delivery with real yield, real contracts, and real flows.

## Glossary

- **QuestVault**: An ERC-4626 compliant vault contract that handles user deposits and generates real yield from Mantle-native strategies
- **XPManager**: A contract that converts realized yield into experience points (XP) for user progression
- **BadgeNFT**: A non-transferable (soulbound) NFT contract that represents on-chain achievements
- **LeaderboardSnapshot**: A contract that records periodic rankings optimized for read access
- **Quest**: A yield strategy that users can participate in by depositing assets
- **XP**: Experience points earned from realized yield, used for leveling and leaderboard ranking
- **Level**: A progression tier unlocked by accumulating XP thresholds
- **Badge**: A non-transferable on-chain achievement NFT
- **Realized_Yield**: Actual yield generated from vault strategies, recognized only at explicit actions (withdraw, claimYield, or admin harvest)—not projected or per-block
- **Mantle_Network**: The target EVM-compatible L2 blockchain for deployment

## Requirements

### Requirement 1: Vault Deposit and Withdrawal

**User Story:** As a user, I want to deposit assets into a yield vault, so that I can earn real yield and participate in quests.

#### Acceptance Criteria

1. WHEN a user deposits assets into the QuestVault, THE QuestVault SHALL mint shares proportional to the deposited amount using ERC-4626 standard
2. WHEN a user withdraws from the QuestVault, THE QuestVault SHALL burn shares and return proportional assets to the user
3. THE QuestVault SHALL emit Deposit and Withdraw events with user address, asset amount, and share amount
4. IF a user attempts to deposit zero assets, THEN THE QuestVault SHALL revert the transaction with a descriptive error
5. IF a user attempts to withdraw more shares than owned, THEN THE QuestVault SHALL revert the transaction with a descriptive error
6. THE QuestVault SHALL track each user's deposit timestamp for XP calculation purposes

### Requirement 2: Real Yield Generation

**User Story:** As a user, I want my deposited assets to generate real yield, so that my progress is backed by actual value.

#### Acceptance Criteria

1. THE QuestVault SHALL generate yield only from real Mantle-native strategies (lending, LP, etc.)
2. THE QuestVault SHALL NOT use mock yield, fake APR, or simulated returns
3. WHEN yield is generated, THE QuestVault SHALL update totalAssets to reflect actual vault value
4. THE QuestVault SHALL provide a view function to query current yield for any user based on share value appreciation
5. THE QuestVault SHALL emit YieldAccrued events when yield is harvested or realized
6. Realized_Yield SHALL be recognized only at explicit actions (withdraw, claimYield, or admin harvest), NOT continuously per block

### Requirement 3: XP Calculation and Accrual

**User Story:** As a user, I want to earn XP based on my realized yield, so that I can progress through levels and compete on leaderboards.

#### Acceptance Criteria

1. WHEN yield is realized for a user, THE XPManager SHALL calculate XP based on the yield amount
2. THE XPManager SHALL apply a configurable XP multiplier per unit of yield
3. THE XPManager SHALL track cumulative XP per user address
4. THE XPManager SHALL emit XPEarned events with user address, yield amount, and XP awarded
5. THE XPManager SHALL provide a view function to query current XP for any user
6. THE XPManager SHALL NOT award XP for unrealized or projected yield—only realized yield counts
7. THE XPManager SHALL only accept XP minting calls from QuestVault (on withdraw/claimYield) or admin—frontend SHALL NOT call XPManager directly

### Requirement 4: Level Progression

**User Story:** As a user, I want to level up based on my accumulated XP, so that I can unlock visual upgrades and higher leaderboard weight.

#### Acceptance Criteria

1. THE XPManager SHALL define configurable XP thresholds for each level (e.g., Level 1: 0 XP, Level 2: 100 XP, Level 3: 500 XP)
2. WHEN a user's cumulative XP crosses a level threshold, THE XPManager SHALL update the user's level
3. THE XPManager SHALL emit LevelUp events with user address, new level, and XP at time of level-up
4. THE XPManager SHALL provide a view function to query current level for any user
5. THE XPManager SHALL provide a view function to query XP required for next level

### Requirement 5: Badge Minting

**User Story:** As a user, I want to unlock achievement badges, so that I can display my accomplishments on-chain.

#### Acceptance Criteria

1. THE BadgeNFT SHALL mint non-transferable (soulbound) NFTs representing achievements
2. WHEN a user meets badge criteria (e.g., first deposit, reaching Level 5, top 10% contributor), THE BadgeNFT SHALL mint the corresponding badge to the user
3. THE BadgeNFT SHALL prevent transfer of badges between addresses (soulbound)
4. THE BadgeNFT SHALL emit BadgeMinted events with user address, badge type, and timestamp
5. THE BadgeNFT SHALL provide a view function to query all badges owned by a user
6. THE BadgeNFT SHALL prevent duplicate badges of the same type for the same user

### Requirement 6: Leaderboard Snapshots

**User Story:** As a user, I want to see my ranking on leaderboards, so that I can compete with other players.

#### Acceptance Criteria

1. THE LeaderboardSnapshot SHALL record periodic rankings based on pure XP (no weighted XP for MVP)
2. THE LeaderboardSnapshot SHALL store top N users (configurable, e.g., top 100) per snapshot
3. THE LeaderboardSnapshot SHALL emit SnapshotCreated events with snapshot ID and timestamp
4. THE LeaderboardSnapshot SHALL provide view functions to query rankings by snapshot ID
5. THE LeaderboardSnapshot SHALL be optimized for read access (minimal gas for queries)
6. WHEN a snapshot is created, THE LeaderboardSnapshot SHALL pull current XP data from XPManager
7. THE LeaderboardSnapshot SHALL store immutable XP values per user at snapshot time to ensure historical consistency

### Requirement 7: Frontend Contract Integration

**User Story:** As a frontend developer, I want clear contract interfaces, so that I can wire the existing Lovable frontend to new contracts.

#### Acceptance Criteria

1. THE QuestVault SHALL expose deposit(assets, receiver) and withdraw(assets, receiver, owner) functions per ERC-4626
2. THE QuestVault SHALL expose balanceOf(user), totalAssets(), and convertToAssets(shares) view functions
3. THE XPManager SHALL expose getXP(user), getLevel(user), and getXPToNextLevel(user) view functions
4. THE BadgeNFT SHALL expose getBadges(user) and hasBadge(user, badgeType) view functions
5. THE LeaderboardSnapshot SHALL expose getTopUsers(snapshotId, count) and getUserRank(snapshotId, user) view functions
6. ALL contracts SHALL emit events for state changes to enable event-driven UI updates

### Requirement 8: Access Control and Security

**User Story:** As a protocol administrator, I want secure access controls, so that only authorized actions can modify critical state.

#### Acceptance Criteria

1. THE QuestVault SHALL implement Ownable or AccessControl for admin functions
2. THE XPManager SHALL restrict XP minting to authorized callers (QuestVault or admin)
3. THE BadgeNFT SHALL restrict badge minting to authorized callers (XPManager or admin)
4. THE LeaderboardSnapshot SHALL restrict snapshot creation to authorized callers
5. ALL contracts SHALL implement Pausable for emergency circuit breaker functionality
6. IF a contract is paused, THEN THE contract SHALL revert deposit, XP minting, and badge minting transactions
7. IF a contract is paused, THEN THE QuestVault SHALL still allow withdraw to protect user funds (emergency exit)

### Requirement 9: Event-Driven Architecture

**User Story:** As a system integrator, I want comprehensive event emission, so that off-chain indexers can track all state changes.

#### Acceptance Criteria

1. THE QuestVault SHALL emit Deposit, Withdraw, and YieldAccrued events
2. THE XPManager SHALL emit XPEarned and LevelUp events
3. THE BadgeNFT SHALL emit BadgeMinted events
4. THE LeaderboardSnapshot SHALL emit SnapshotCreated events
5. ALL events SHALL include indexed parameters for efficient filtering (user address, timestamp)

### Requirement 10: Demo Day Flow

**User Story:** As a demo presenter, I want a smooth 90-second demo flow, so that I can showcase the full user journey.

#### Acceptance Criteria

1. THE system SHALL support the following demo flow: connect wallet → deposit → earn yield → see XP increase → level up → unlock badge → appear on leaderboard
2. THE QuestVault SHALL process deposits within a single transaction
3. THE XPManager SHALL update XP and level within a single transaction when yield is claimed
4. THE BadgeNFT SHALL mint badges automatically when criteria are met
5. THE LeaderboardSnapshot SHALL reflect updated rankings within one snapshot cycle
6. ALL user-facing transactions SHALL complete with reasonable gas costs on Mantle Network

## Assumptions (Locked for v1)

1. Single vault strategy for MVP (one QuestVault instance)
2. No guild functionality in MVP (individual play only)
3. No governance token in MVP
4. Leaderboard snapshots are triggered manually or by admin (not automated)
5. Badge criteria are hardcoded for MVP (not configurable via governance)
6. Frontend already exists (Lovable) and only needs contract wiring
7. Target network is Mantle Sepolia testnet for hackathon demo
8. Leaderboard ranking uses pure XP only (no weighted XP—"higher leaderboard weight" is post-hackathon)
9. XPManager is called only by QuestVault (on yield realization) or admin (manual adjustment)
10. XP is awarded only via explicit claim actions, not per-block accrual

## Non-Goals (Explicitly Excluded)

1. ZK yield proofs (post-hackathon)
2. DAO governance layer (post-hackathon)
3. Cross-game integrations (post-hackathon)
4. Sponsored quests (post-hackathon)
5. Guild staking and guild XP aggregation (post-hackathon)
6. Multiple vault strategies (post-hackathon)
7. Automated leaderboard snapshots (post-hackathon)
8. Token emissions or yield farming rewards (never—real yield only)
9. Weighted leaderboard scoring (post-hackathon)
