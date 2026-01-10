// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IXPManager {
    function getXP(address user) external view returns (uint256);
}

/**
 * @title LeaderboardSnapshot
 * @notice Records periodic rankings optimized for read access
 * @dev Stores immutable snapshots of top N users by XP
 */
contract LeaderboardSnapshot is Ownable {
    // Structs
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

    // State variables
    mapping(uint256 => Snapshot) private snapshots;
    uint256 public snapshotCount;
    uint256 public maxEntriesPerSnapshot;
    address public xpManager;

    // Custom errors
    error SnapshotNotFound(uint256 snapshotId);
    error TooManyEntries(uint256 provided, uint256 max);
    error InvalidXPManager();
    error InvalidMaxEntries();

    // Events
    event SnapshotCreated(
        uint256 indexed snapshotId,
        uint256 timestamp,
        uint256 totalUsers
    );
    event MaxEntriesUpdated(uint256 oldMax, uint256 newMax);
    event XPManagerUpdated(address indexed oldManager, address indexed newManager);

    /**
     * @notice Constructor
     * @param initialOwner Address of the contract owner
     * @param _maxEntriesPerSnapshot Maximum entries per snapshot (e.g., 100)
     * @param _xpManager Address of the XPManager contract
     */
    constructor(
        address initialOwner,
        uint256 _maxEntriesPerSnapshot,
        address _xpManager
    ) Ownable(initialOwner) {
        if (_maxEntriesPerSnapshot == 0) revert InvalidMaxEntries();
        if (_xpManager == address(0)) revert InvalidXPManager();
        
        maxEntriesPerSnapshot = _maxEntriesPerSnapshot;
        xpManager = _xpManager;
        snapshotCount = 0;
    }

    // Core functions

    /**
     * @notice Create a new leaderboard snapshot
     * @dev Only callable by owner. Users array MUST be pre-sorted off-chain by XP descending
     * @param users Array of user addresses (pre-sorted by XP descending)
     */
    function createSnapshot(address[] calldata users) external onlyOwner {
        // Validate users array length
        if (users.length > maxEntriesPerSnapshot) {
            revert TooManyEntries(users.length, maxEntriesPerSnapshot);
        }

        // Increment snapshot count
        uint256 snapshotId = snapshotCount++;
        
        // Create new snapshot
        Snapshot storage snapshot = snapshots[snapshotId];
        snapshot.id = snapshotId;
        snapshot.timestamp = block.timestamp;
        snapshot.totalUsers = users.length;

        // Pull XP values from XPManager and store entries
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 xp = IXPManager(xpManager).getXP(user);
            
            // Create entry with rank (1-based)
            SnapshotEntry memory entry = SnapshotEntry({
                user: user,
                xp: xp,
                rank: i + 1
            });
            
            snapshot.entries.push(entry);
        }

        // Emit event
        emit SnapshotCreated(snapshotId, block.timestamp, users.length);
    }

    // View functions

    /**
     * @notice Get a complete snapshot by ID
     * @param snapshotId ID of the snapshot to retrieve
     * @return snapshot Snapshot struct with all entries
     */
    function getSnapshot(uint256 snapshotId) external view returns (Snapshot memory snapshot) {
        if (snapshotId >= snapshotCount) {
            revert SnapshotNotFound(snapshotId);
        }
        
        Snapshot storage storedSnapshot = snapshots[snapshotId];
        
        // Manually construct memory struct with array
        snapshot.id = storedSnapshot.id;
        snapshot.timestamp = storedSnapshot.timestamp;
        snapshot.totalUsers = storedSnapshot.totalUsers;
        
        // Copy entries array
        snapshot.entries = new SnapshotEntry[](storedSnapshot.entries.length);
        for (uint256 i = 0; i < storedSnapshot.entries.length; i++) {
            snapshot.entries[i] = storedSnapshot.entries[i];
        }
        
        return snapshot;
    }

    /**
     * @notice Get top N users from a snapshot
     * @param snapshotId ID of the snapshot
     * @param count Number of top users to return
     * @return Array of SnapshotEntry structs
     */
    function getTopUsers(uint256 snapshotId, uint256 count) 
        external 
        view 
        returns (SnapshotEntry[] memory) 
    {
        if (snapshotId >= snapshotCount) {
            revert SnapshotNotFound(snapshotId);
        }

        Snapshot storage snapshot = snapshots[snapshotId];
        uint256 returnCount = count > snapshot.totalUsers ? snapshot.totalUsers : count;
        
        SnapshotEntry[] memory topUsers = new SnapshotEntry[](returnCount);
        for (uint256 i = 0; i < returnCount; i++) {
            topUsers[i] = snapshot.entries[i];
        }
        
        return topUsers;
    }

    /**
     * @notice Get a user's rank and XP in a specific snapshot
     * @param snapshotId ID of the snapshot
     * @param user Address of the user
     * @return rank User's rank (0 if not found)
     * @return xp User's XP at snapshot time (0 if not found)
     */
    function getUserRank(uint256 snapshotId, address user) 
        external 
        view 
        returns (uint256 rank, uint256 xp) 
    {
        if (snapshotId >= snapshotCount) {
            revert SnapshotNotFound(snapshotId);
        }

        Snapshot storage snapshot = snapshots[snapshotId];
        
        // Search for user in entries
        for (uint256 i = 0; i < snapshot.entries.length; i++) {
            if (snapshot.entries[i].user == user) {
                return (snapshot.entries[i].rank, snapshot.entries[i].xp);
            }
        }
        
        // User not found in snapshot
        return (0, 0);
    }

    /**
     * @notice Get the latest snapshot ID
     * @return Latest snapshot ID (0 if no snapshots exist)
     */
    function getLatestSnapshotId() external view returns (uint256) {
        if (snapshotCount == 0) {
            return 0;
        }
        return snapshotCount - 1;
    }

    /**
     * @notice Get the number of entries in a snapshot
     * @param snapshotId ID of the snapshot
     * @return Number of entries in the snapshot
     */
    function getSnapshotEntriesCount(uint256 snapshotId) external view returns (uint256) {
        if (snapshotId >= snapshotCount) {
            revert SnapshotNotFound(snapshotId);
        }
        return snapshots[snapshotId].entries.length;
    }

    // Admin functions

    /**
     * @notice Set the maximum entries per snapshot
     * @dev Only callable by owner
     * @param _max New maximum entries per snapshot
     */
    function setMaxEntries(uint256 _max) external onlyOwner {
        if (_max == 0) revert InvalidMaxEntries();
        uint256 oldMax = maxEntriesPerSnapshot;
        maxEntriesPerSnapshot = _max;
        emit MaxEntriesUpdated(oldMax, _max);
    }

    /**
     * @notice Set the XPManager contract address
     * @dev Only callable by owner
     * @param _xpManager Address of the XPManager contract
     */
    function setXPManager(address _xpManager) external onlyOwner {
        if (_xpManager == address(0)) revert InvalidXPManager();
        address oldManager = xpManager;
        xpManager = _xpManager;
        emit XPManagerUpdated(oldManager, _xpManager);
    }
}
