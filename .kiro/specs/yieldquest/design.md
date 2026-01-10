# Design Document: YieldQuest Rebuild

## Overview

YieldQuest is a GameFi protocol on Mantle Network that gamifies real DeFi yield. This design document specifies the technical architecture for rebuilding YieldQuest from scratch with four core smart contracts: QuestVault, XPManager, BadgeNFT, and LeaderboardSnapshot.

**Role: Solution Architect**

### Design Principles

1. **Real Yield Only**: All XP derives from actual vault yield—no mock, fake, or simulated returns
2. **Modular Architecture**: Each contract has a single responsibility with clear interfaces
3. **Event-Driven**: All state changes emit events for off-chain indexing
4. **Minimal Trust**: Users maintain custody; admin powers are limited and pausable
5. **Gas Efficient**: Optimized for Mantle L2's low-cost environment

## Architecture

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Lovable)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Deposit  │ │ Profile  │ │ Badges   │ │ Leaderboard      │   │
│  │ Screen   │ │ Screen   │ │ Screen   │ │ Screen           │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
└───────┼────────────┼────────────┼────────────────┼─────────────┘
        │            │            │                │
        ▼            ▼            ▼                ▼
┌───────────────────────────────────────────────────────────────┐
│                    SMART CONTRACTS (Mantle)                    │
│                                                                │
│  ┌─────────────────┐      ┌─────────────────┐                 │
│  │   QuestVault    │─────▶│   XPManager     │                 │
│  │   (ERC-4626)    │      │                 │                 │
│  │                 │      │  ┌───────────┐  │                 │
│  │ • deposit()     │      │  │ awardXP() │  │                 │
│  │ • withdraw()    │      │  └─────┬─────┘  │                 │
│  │ • claimYield()  │      │        │        │                 │
│  └────────┬────────┘      └────────┼────────┘                 │
│           │                        │                          │
│           │                        ▼                          │
│           │               ┌─────────────────┐                 │
│           │               │   BadgeNFT      │                 │
│           │               │  (Soulbound)    │                 │
│           │               └─────────────────┘                 │
│           │                                                   │
│           │               ┌─────────────────┐                 │
│           └──────────────▶│ Leaderboard     │                 │
│                           │ Snapshot        │                 │
│                           └─────────────────┘                 │
└───────────────────────────────────────────────────────────────┘
```


### On-Chain vs Off-Chain Responsibility Split

**Role: Solution Architect**

| Responsibility | On-Chain | Off-Chain |
|----------------|----------|-----------|
| Asset custody | ✅ QuestVault | - |
| Yield generation | ✅ QuestVault strategy | - |
| XP calculation | ✅ XPManager | - |
| Level tracking | ✅ XPManager | - |
| Badge ownership | ✅ BadgeNFT | - |
| Leaderboard snapshots | ✅ LeaderboardSnapshot | - |
| Historical rankings | ✅ Immutable snapshots | Indexer for queries |
| Real-time leaderboard | - | ✅ Frontend reads XPManager |
| User profiles | - | ✅ Frontend aggregates data |
| Notifications | - | ✅ Event listeners |

### Trust Assumptions

1. **Admin (Owner)**: Can pause contracts, trigger snapshots, adjust XP multiplier. Cannot steal funds.
2. **QuestVault**: Trusted to call XPManager on yield realization. Only authorized caller for XP minting.
3. **XPManager**: Trusted to call BadgeNFT for badge criteria. Only authorized caller for badge minting.
4. **Users**: Self-custody of assets. Can always withdraw (even when paused).

### Data Flow: Deposit → Yield → XP → Badge → Leaderboard

```
1. User deposits assets
   └─▶ QuestVault.deposit(assets, receiver)
       └─▶ Mint shares to user
       └─▶ Record deposit timestamp
       └─▶ Emit Deposit event

2. Yield accrues (from strategy)
   └─▶ totalAssets increases
   └─▶ Share value appreciates

3. User claims yield (or withdraws)
   └─▶ QuestVault.claimYield() or withdraw()
       └─▶ Calculate realized yield
       └─▶ Call XPManager.awardXP(user, yieldAmount)
           └─▶ Calculate XP = yield * multiplier
           └─▶ Update cumulative XP
           └─▶ Check level threshold
           └─▶ If level up: emit LevelUp, check badge criteria
               └─▶ BadgeNFT.mint(user, badgeType)
           └─▶ Emit XPEarned event
       └─▶ Emit YieldAccrued event

4. Admin creates leaderboard snapshot
   └─▶ LeaderboardSnapshot.createSnapshot()
       └─▶ Read top N users from XPManager
       └─▶ Store immutable ranking data
       └─▶ Emit SnapshotCreated event
```

## Components and Interfaces

**Role: Principal Engineer (Smart Contract)**

### Contract 1: QuestVault (ERC-4626)

**Purpose**: Handle user deposits, generate real yield, and trigger XP awards on yield realization.

**Core Responsibilities**:
- Accept deposits and mint proportional shares (ERC-4626)
- Track deposit timestamps per user
- Generate yield from Mantle-native strategies
- Calculate and distribute realized yield
- Trigger XPManager on yield realization
- Allow emergency withdrawals even when paused

**Key State Variables**:
```solidity
// Inherited from ERC-4626
IERC20 public immutable asset;
uint256 public totalAssets;

// YieldQuest-specific
mapping(address => uint256) public depositTimestamp;
mapping(address => uint256) public lastClaimedAssets; // User's asset-equivalent share value at last claim/withdraw
IXPManager public xpManager;
bool public paused;
address public owner;
```

**Key Functions (Signatures Only)**:
```solidity
// ERC-4626 Standard
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

// View functions
function balanceOf(address user) external view returns (uint256);
function totalAssets() external view returns (uint256);
function convertToAssets(uint256 shares) external view returns (uint256);
function convertToShares(uint256 assets) external view returns (uint256);
function getUserYield(address user) external view returns (uint256);

// YieldQuest-specific
function claimYield() external returns (uint256 yieldAmount);
function setXPManager(address _xpManager) external; // onlyOwner

// Admin
function pause() external; // onlyOwner
function unpause() external; // onlyOwner
```

**Events**:
```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
event YieldAccrued(address indexed user, uint256 yieldAmount, uint256 timestamp);
event Paused(address account);
event Unpaused(address account);
```

**Security Considerations**:
- ReentrancyGuard on deposit/withdraw/claimYield
- CEI pattern (Checks-Effects-Interactions)
- Withdraw allowed even when paused (emergency exit)
- Zero amount checks on deposit
- Overflow protection (Solidity 0.8+)

**Upgradeability**: Non-upgradeable for MVP. Immutable core logic reduces attack surface.


### Contract 2: XPManager

**Purpose**: Convert realized yield into XP, track levels, and trigger badge minting.

**Core Responsibilities**:
- Receive yield amounts from QuestVault
- Calculate XP using configurable multiplier
- Track cumulative XP per user
- Determine user level based on XP thresholds
- Emit events for XP and level changes
- Trigger BadgeNFT for level-based badges

**Key State Variables**:
```solidity
mapping(address => uint256) public userXP;
mapping(address => uint256) public userLevel;
uint256 public xpMultiplier; // XP per unit of yield (e.g., 100 = 100 XP per 1 token yield)
uint256[] public levelThresholds; // XP required for each level
IBadgeNFT public badgeNFT;
address public questVault; // Only authorized caller
address public owner;
bool public paused;
```

**Key Functions (Signatures Only)**:
```solidity
// Core functions
function awardXP(address user, uint256 yieldAmount) external; // onlyQuestVault or onlyOwner
function getXP(address user) external view returns (uint256);
function getLevel(address user) external view returns (uint256);
function getXPToNextLevel(address user) external view returns (uint256);
function getLevelThreshold(uint256 level) external view returns (uint256);

// Admin
function setXPMultiplier(uint256 _multiplier) external; // onlyOwner
function setLevelThresholds(uint256[] calldata _thresholds) external; // onlyOwner
function setBadgeNFT(address _badgeNFT) external; // onlyOwner
function setQuestVault(address _questVault) external; // onlyOwner
function pause() external; // onlyOwner
function unpause() external; // onlyOwner
```

**Events**:
```solidity
event XPEarned(address indexed user, uint256 yieldAmount, uint256 xpAwarded, uint256 totalXP);
event LevelUp(address indexed user, uint256 newLevel, uint256 xpAtLevelUp);
```

**Security Considerations**:
- Only QuestVault or owner can call awardXP (access control)
- Pausable for emergency
- No external calls in XP calculation (pure math)
- Level thresholds must be monotonically increasing

**Upgradeability**: Non-upgradeable for MVP.

### Contract 3: BadgeNFT (Soulbound)

**Purpose**: Mint non-transferable achievement NFTs.

**Core Responsibilities**:
- Mint soulbound badges to users
- Prevent all transfers (override transfer functions)
- Track badge ownership per user
- Prevent duplicate badges of same type

**Key State Variables**:
```solidity
mapping(address => mapping(uint256 => bool)) public hasBadge; // user => badgeType => owned
mapping(address => uint256[]) public userBadges; // user => list of badge types
mapping(uint256 => string) public badgeMetadata; // badgeType => metadata URI
address public xpManager; // Only authorized caller
address public owner;
uint256 public nextTokenId;
```

**Badge Types (Hardcoded for MVP)**:
```solidity
uint256 public constant BADGE_EARLY_ADOPTER = 1;
uint256 public constant BADGE_FIRST_DEPOSIT = 2;
uint256 public constant BADGE_LEVEL_5 = 3;
uint256 public constant BADGE_LEVEL_10 = 4;
uint256 public constant BADGE_YIELD_MASTER = 5; // 1000+ XP
```

**Key Functions (Signatures Only)**:
```solidity
// Core functions
function mint(address to, uint256 badgeType) external; // onlyXPManager or onlyOwner
function getBadges(address user) external view returns (uint256[] memory);
function hasBadgeType(address user, uint256 badgeType) external view returns (bool);

// Soulbound overrides (all revert)
function transferFrom(address from, address to, uint256 tokenId) public override; // REVERTS
function safeTransferFrom(address from, address to, uint256 tokenId) public override; // REVERTS
function approve(address to, uint256 tokenId) public override; // REVERTS
function setApprovalForAll(address operator, bool approved) public override; // REVERTS

// Admin
function setXPManager(address _xpManager) external; // onlyOwner
function setBadgeMetadata(uint256 badgeType, string calldata uri) external; // onlyOwner
```

**Events**:
```solidity
event BadgeMinted(address indexed user, uint256 indexed badgeType, uint256 tokenId, uint256 timestamp);
```

**Security Considerations**:
- All transfer functions revert (soulbound)
- Only XPManager or owner can mint
- Duplicate badge check before minting
- No approval mechanism (soulbound)

**Upgradeability**: Non-upgradeable for MVP.


### Contract 4: LeaderboardSnapshot

**Purpose**: Record periodic rankings optimized for read access.

**Core Responsibilities**:
- Create immutable snapshots of top N users by XP
- Store XP values at snapshot time (historical consistency)
- Provide efficient read functions for rankings
- Emit events for indexers

**Key State Variables**:
```solidity
struct SnapshotEntry {
    address user;
    uint256 xp;
    uint256 rank;
}

struct Snapshot {
    uint256 id;
    uint256 timestamp;
    uint256 totalUsers;
    SnapshotEntry[] entries;
}

mapping(uint256 => Snapshot) public snapshots;
uint256 public snapshotCount;
uint256 public maxEntriesPerSnapshot; // e.g., 100
IXPManager public xpManager;
address public owner;
```

**Key Functions (Signatures Only)**:
```solidity
// Core functions
function createSnapshot(address[] calldata users) external; // onlyOwner
function getSnapshot(uint256 snapshotId) external view returns (Snapshot memory);
function getTopUsers(uint256 snapshotId, uint256 count) external view returns (SnapshotEntry[] memory);
function getUserRank(uint256 snapshotId, address user) external view returns (uint256 rank, uint256 xp);
function getLatestSnapshotId() external view returns (uint256);

// Admin
function setMaxEntries(uint256 _max) external; // onlyOwner
function setXPManager(address _xpManager) external; // onlyOwner
```

**Events**:
```solidity
event SnapshotCreated(uint256 indexed snapshotId, uint256 timestamp, uint256 totalUsers);
```

**Security Considerations**:
- Only owner can create snapshots (manual trigger for MVP)
- Snapshot data is immutable after creation
- Gas optimization: limit entries per snapshot
- Users array passed by admin (off-chain sorting)

**Upgradeability**: Non-upgradeable for MVP.

## Data Models

**Role: Solution Architect**

### User State (Aggregated View)

```typescript
interface UserState {
  // From QuestVault
  shares: uint256;
  depositTimestamp: uint256;
  lastClaimedAssets: uint256;
  currentAssets: uint256; // convertToAssets(shares)
  unrealizedYield: uint256; // currentAssets - lastClaimedAssets
  
  // From XPManager
  totalXP: uint256;
  level: uint256;
  xpToNextLevel: uint256;
  
  // From BadgeNFT
  badges: uint256[]; // Array of badge types
  
  // From LeaderboardSnapshot (latest)
  rank: uint256;
  snapshotXP: uint256;
}
```

### Level Thresholds (Default Configuration)

| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1 | 0 | 0 |
| 2 | 100 | 100 |
| 3 | 250 | 350 |
| 4 | 500 | 850 |
| 5 | 1000 | 1850 |
| 6 | 2000 | 3850 |
| 7 | 4000 | 7850 |
| 8 | 8000 | 15850 |
| 9 | 16000 | 31850 |
| 10 | 32000 | 63850 |

### Badge Criteria (Hardcoded for MVP)

| Badge Type | ID | Criteria |
|------------|-----|----------|
| Early Adopter | 1 | First 100 depositors (admin mints) |
| First Deposit | 2 | Any deposit > 0 |
| Level 5 | 3 | Reach level 5 |
| Level 10 | 4 | Reach level 10 |
| Yield Master | 5 | Accumulate 1000+ XP |


## Correctness Properties

**Role: Principal Engineer + QA Engineer**

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Deposit-Withdraw Round Trip

*For any* user and any deposit amount > 0, depositing assets and then immediately withdrawing all shares should return the original asset amount (assuming no yield accrued and no fees).

**Validates: Requirements 1.1, 1.2**

### Property 2: Share Proportionality Invariant

*For any* deposit, the shares minted should equal `assets * totalSupply / totalAssets` (or `assets` if totalSupply is 0). This ERC-4626 invariant must hold for all deposits.

**Validates: Requirements 1.1**

### Property 3: XP Calculation Determinism

*For any* yield amount and XP multiplier, the XP awarded should equal `yieldAmount * xpMultiplier / PRECISION`. The calculation must be deterministic and reproducible.

**Validates: Requirements 3.1, 3.2**

### Property 4: XP Accumulation Monotonicity

*For any* user, cumulative XP should only increase (never decrease). After any awardXP call, `newXP >= oldXP`.

**Validates: Requirements 3.3**

### Property 5: Level Threshold Consistency

*For any* user with XP amount X, their level should be the highest level L where `levelThreshold[L] <= X`. Level must be consistent with XP at all times.

**Validates: Requirements 4.1, 4.2**

### Property 6: Soulbound Transfer Prohibition

*For any* badge token, all transfer operations (transferFrom, safeTransferFrom) must revert. Badges cannot change ownership after minting.

**Validates: Requirements 5.1, 5.3**

### Property 7: Badge Uniqueness Per User

*For any* user and badge type, at most one badge of that type can exist. Attempting to mint a duplicate badge must revert.

**Validates: Requirements 5.6**

### Property 8: Snapshot Immutability

*For any* snapshot ID, the stored XP values and rankings must not change after creation. Querying the same snapshot at different times must return identical data.

**Validates: Requirements 6.7**

### Property 9: Leaderboard Ordering

*For any* snapshot, entries must be ordered by XP descending. For all i < j in the entries array, `entries[i].xp >= entries[j].xp`.

**Validates: Requirements 6.1**

### Property 10: Access Control Enforcement

*For any* call to awardXP from an address that is not QuestVault or owner, the transaction must revert. Unauthorized callers cannot mint XP.

**Validates: Requirements 3.7, 8.2**

### Property 11: Pause Behavior - Deposit Blocked

*For any* paused QuestVault, deposit calls must revert. Users cannot deposit when paused.

**Validates: Requirements 8.6**

### Property 12: Pause Behavior - Withdraw Allowed

*For any* paused QuestVault, withdraw calls must succeed (emergency exit). Users can always withdraw their funds.

**Validates: Requirements 8.7**

### Property 13: Event Emission Completeness

*For any* state-changing operation (deposit, withdraw, XP award, badge mint, snapshot creation), the corresponding event must be emitted with correct parameters.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 14: XP Only From Realized Yield

*For any* user, XP should only increase when claimYield() or withdraw() is called. XP must not change between blocks without explicit user action.

**Validates: Requirements 2.6, 3.6**


## Error Handling

**Role: Principal Engineer**

### Custom Errors (Gas Efficient)

```solidity
// QuestVault errors
error ZeroDeposit();
error InsufficientShares(uint256 requested, uint256 available);
error Paused();
error NotPaused();
error Unauthorized();

// XPManager errors
error OnlyQuestVault();
error OnlyOwner();
error InvalidMultiplier();
error InvalidThresholds();

// BadgeNFT errors
error SoulboundTransferProhibited();
error BadgeAlreadyOwned(address user, uint256 badgeType);
error OnlyXPManager();

// LeaderboardSnapshot errors
error SnapshotNotFound(uint256 snapshotId);
error TooManyEntries(uint256 provided, uint256 max);
```

### Error Handling Strategy

| Scenario | Contract | Error | Recovery |
|----------|----------|-------|----------|
| Zero deposit | QuestVault | ZeroDeposit | User retries with amount > 0 |
| Over-withdraw | QuestVault | InsufficientShares | User checks balance first |
| Paused deposit | QuestVault | Paused | Wait for unpause |
| Unauthorized XP | XPManager | OnlyQuestVault | N/A (attack blocked) |
| Badge transfer | BadgeNFT | SoulboundTransferProhibited | N/A (by design) |
| Duplicate badge | BadgeNFT | BadgeAlreadyOwned | N/A (already has badge) |

## Testing Strategy

**Role: QA Engineer**

### Unit Test Scope

**QuestVault Tests**:
- deposit() mints correct shares
- withdraw() burns shares and returns assets
- claimYield() calculates correct yield
- Pause blocks deposits but allows withdrawals
- Zero deposit reverts
- Events emitted correctly

**XPManager Tests**:
- awardXP() calculates XP correctly
- Level updates at threshold crossings
- Only authorized callers can award XP
- XP accumulates correctly over multiple awards
- Events emitted correctly

**BadgeNFT Tests**:
- mint() creates badge for user
- All transfer functions revert
- Duplicate badge minting reverts
- getBadges() returns correct list
- Events emitted correctly

**LeaderboardSnapshot Tests**:
- createSnapshot() stores correct data
- Snapshot data is immutable
- getTopUsers() returns correct ordering
- getUserRank() returns correct rank
- Events emitted correctly

### Integration Test Scope

**Full Flow Tests**:
1. Deposit → Yield → ClaimYield → XP → Level Up → Badge
2. Multiple users competing for leaderboard
3. Pause/unpause cycle with user operations
4. Admin operations (set multiplier, create snapshot)

### Property Tests (Invariant Checks via Loops)

Using Hardhat with loop-based property testing:

```typescript
// In test files using Chai + ethers
// All tests written in TypeScript under /test directory using Hardhat + ethers + chai

describe("Property Tests", function () {
  it("should never lose assets (totalAssets >= sum of deposits)", async function () {
    let totalDeposited = 0n;
    for (let i = 0; i < 20; i++) {
      const randomAmount = ethers.parseEther((Math.random() * 100 + 1).toFixed(2));
      await vault.connect(users[i % users.length]).deposit(randomAmount, users[i % users.length].address);
      totalDeposited += randomAmount;
      expect(await vault.totalAssets()).to.be.gte(totalDeposited);
    }
  });

  it("should only increase XP (monotonic)", async function () {
    const previousXP: Record<string, bigint> = {};
    for (let i = 0; i < 20; i++) {
      const user = users[i % users.length];
      previousXP[user.address] = await xpManager.getXP(user.address);
      
      // Simulate yield and claim
      await simulateYield(vault);
      await vault.connect(user).claimYield();
      
      const currentXP = await xpManager.getXP(user.address);
      expect(currentXP).to.be.gte(previousXP[user.address]);
    }
  });

  it("should have level consistent with XP", async function () {
    for (const user of users) {
      const xp = await xpManager.getXP(user.address);
      const level = await xpManager.getLevel(user.address);
      const threshold = await xpManager.getLevelThreshold(level);
      expect(xp).to.be.gte(threshold);
      if (level < maxLevel) {
        const nextThreshold = await xpManager.getLevelThreshold(level + 1);
        expect(xp).to.be.lt(nextThreshold);
      }
    }
  });
});

// Yield simulation helper (anti-mock: uses real token transfer, not fake APR)
async function simulateYield(vault: QuestVault) {
  // Mint additional underlying tokens to vault to simulate real yield
  // This increases totalAssets without minting new shares
  const yieldAmount = ethers.parseEther("10");
  await underlyingToken.mint(await vault.getAddress(), yieldAmount);
}
```

### Manual Test Checklist for Demo Day

**Role: QA Engineer**

- [ ] Connect wallet to Mantle Sepolia
- [ ] Deposit test tokens into QuestVault
- [ ] Verify shares received match expected amount
- [ ] Wait for yield accrual (or simulate via admin)
- [ ] Claim yield and verify XP increase
- [ ] Verify level up if threshold crossed
- [ ] Verify badge minted if criteria met
- [ ] Check leaderboard shows user ranking
- [ ] Withdraw partial amount
- [ ] Withdraw remaining amount
- [ ] Verify all events in block explorer
- [ ] Test pause/unpause (admin)
- [ ] Test emergency withdraw while paused
- [ ] Complete full flow in under 90 seconds


## Security, Risks & Anti-Patterns

**Role: Principal Engineer + QA Engineer**

### Attack Surfaces

| Surface | Risk | Mitigation |
|---------|------|------------|
| Reentrancy | High | ReentrancyGuard + CEI pattern |
| Access control bypass | High | Explicit onlyOwner/onlyQuestVault modifiers |
| Integer overflow | Medium | Solidity 0.8+ built-in checks |
| Front-running | Low | No price-sensitive operations in MVP |
| Flash loan | Low | No single-block arbitrage opportunity |
| Oracle manipulation | N/A | No external oracles in MVP |

### Economic Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Yield strategy failure | Users lose principal | Use battle-tested strategies only |
| XP inflation | Leaderboard meaningless | XP tied to real yield only |
| Badge farming | Unfair advantages | Soulbound + criteria checks |
| Snapshot manipulation | False rankings | Admin-only snapshots, immutable data |

### Anti-Patterns (MUST NEVER DO)

**Role: Principal Engineer**

1. **NEVER mock yield**: All yield must come from real vault strategies
2. **NEVER award XP per block**: XP only on explicit claim actions
3. **NEVER allow badge transfers**: Soulbound is non-negotiable
4. **NEVER skip access control**: All state changes require authorization
5. **NEVER use tx.origin**: Always use msg.sender for auth
6. **NEVER ignore return values**: Check all external call results
7. **NEVER hardcode addresses**: Use constructor parameters or setters
8. **NEVER skip events**: All state changes must emit events
9. **NEVER block withdrawals**: Emergency exit must always work
10. **NEVER use floating pragma**: Pin Solidity version exactly

### Guardrails for Real Yield Integrity

```solidity
// In QuestVault
modifier onlyRealYield() {
    // Yield = current share value - last claimed value
    // Must be positive and derived from actual totalAssets increase
    uint256 currentValue = convertToAssets(balanceOf(msg.sender));
    uint256 lastClaimed = lastClaimedAssets[msg.sender];
    require(currentValue > lastClaimed, "No yield to claim");
    _;
}

// In XPManager
modifier onlyAuthorized() {
    require(
        msg.sender == questVault || msg.sender == owner,
        "Unauthorized"
    );
    _;
}
```

## Delivery Checklist

**Role: All Roles**

### What "Done" Means for MVP

- [ ] All 4 contracts deployed to Mantle Sepolia
- [ ] All contracts verified on block explorer
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Invariant tests passing
- [ ] Frontend connected and functional
- [ ] Demo flow completable in 90 seconds
- [ ] No critical/high security issues

### Demo Readiness Checklist

**Role: Solution Architect + Fullstack Developer**

- [ ] Test tokens available on Mantle Sepolia
- [ ] Faucet link documented
- [ ] Contract addresses documented
- [ ] ABI files exported for frontend
- [ ] Frontend deployed and accessible
- [ ] Wallet connection working
- [ ] All screens functional (Deposit, Profile, Badges, Leaderboard)
- [ ] Events visible in UI
- [ ] Error messages user-friendly
- [ ] Mobile-responsive (bonus)

### Kill-Switch Criteria (When to Abort a Feature)

**Role: Principal Engineer + QA Engineer**

| Feature | Kill If |
|---------|---------|
| Yield strategy | Cannot generate real yield on testnet |
| XP calculation | Math errors or overflow issues |
| Badge minting | Transfer prevention fails |
| Leaderboard | Gas costs exceed 1M per snapshot |
| Full flow | Cannot complete in 90 seconds |

### Contract Deployment Order

1. Deploy BadgeNFT (no dependencies)
2. Deploy XPManager (set BadgeNFT address)
3. Deploy QuestVault (set XPManager address)
4. Deploy LeaderboardSnapshot (set XPManager address)
5. Configure XPManager.setQuestVault()
6. Configure BadgeNFT.setXPManager()
7. Set level thresholds and XP multiplier
8. Verify all contracts on explorer
9. Test full flow end-to-end

## Technology Stack

**Role: Solution Architect**

| Component | Technology | Version |
|-----------|------------|---------|
| Smart Contracts | Solidity | 0.8.20+ |
| Development Framework | Hardhat | 2.x |
| Testing | Chai + Mocha (Hardhat) | Latest |
| Libraries | OpenZeppelin | 5.x |
| Network | Mantle Sepolia | Testnet |
| Frontend SDK | wagmi + viem | 2.x |
| Wallet | RainbowKit | Latest |

### OpenZeppelin Contracts to Use

- `ERC4626` - Vault standard
- `ERC721` - Badge NFT base
- `Ownable` - Access control
- `ReentrancyGuard` - Reentrancy protection
- `Pausable` - Emergency pause
