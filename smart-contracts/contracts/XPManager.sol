// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IBadgeNFT {
    function mint(address to, uint256 badgeType) external;
}

/**
 * @title XPManager
 * @notice Manages XP (experience points) and level progression for YieldQuest
 * @dev Converts realized yield into XP and tracks user levels
 */
contract XPManager is Ownable, Pausable {
    // Constants
    uint256 public constant PRECISION = 1e18;
    uint256 public constant BADGE_LEVEL_5 = 3;
    uint256 public constant BADGE_LEVEL_10 = 4;

    // State variables
    mapping(address => uint256) public userXP;
    mapping(address => uint256) public userLevel;
    uint256 public xpMultiplier; // XP per unit of yield (scaled by PRECISION)
    uint256[] public levelThresholds; // XP required for each level
    
    address public questVault;
    address public badgeNFT;

    // Custom errors
    error OnlyQuestVault();
    error OnlyOwner();
    error InvalidMultiplier();
    error InvalidThresholds();
    error Unauthorized();

    // Events
    event XPEarned(
        address indexed user,
        uint256 yieldAmount,
        uint256 xpAwarded,
        uint256 totalXP
    );
    event LevelUp(
        address indexed user,
        uint256 newLevel,
        uint256 xpAtLevelUp
    );
    event XPMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    event LevelThresholdsUpdated(uint256[] newThresholds);
    event QuestVaultUpdated(address indexed oldVault, address indexed newVault);
    event BadgeNFTUpdated(address indexed oldBadgeNFT, address indexed newBadgeNFT);

    /**
     * @notice Constructor
     * @param initialOwner Address of the contract owner
     * @param _xpMultiplier Initial XP multiplier (scaled by PRECISION)
     */
    constructor(address initialOwner, uint256 _xpMultiplier) Ownable(initialOwner) {
        if (_xpMultiplier == 0) revert InvalidMultiplier();
        xpMultiplier = _xpMultiplier;
        
        // Initialize default level thresholds (in XP units, scaled by PRECISION)
        levelThresholds.push(0);                    // Level 1: 0 XP
        levelThresholds.push(100 * PRECISION);      // Level 2: 100 XP
        levelThresholds.push(350 * PRECISION);      // Level 3: 350 XP
        levelThresholds.push(850 * PRECISION);      // Level 4: 850 XP
        levelThresholds.push(1850 * PRECISION);     // Level 5: 1850 XP
        levelThresholds.push(3850 * PRECISION);     // Level 6: 3850 XP
        levelThresholds.push(7850 * PRECISION);     // Level 7: 7850 XP
        levelThresholds.push(15850 * PRECISION);    // Level 8: 15850 XP
        levelThresholds.push(31850 * PRECISION);    // Level 9: 31850 XP
        levelThresholds.push(63850 * PRECISION);    // Level 10: 63850 XP
    }

    /**
     * @notice Modifier to restrict access to authorized callers (QuestVault or owner)
     */
    modifier onlyAuthorized() {
        if (msg.sender != questVault && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @notice Award XP to a user based on realized yield
     * @dev Only callable by QuestVault or owner
     * @param user Address of the user to award XP to
     * @param yieldAmount Amount of yield realized
     */
    function awardXP(address user, uint256 yieldAmount) external onlyAuthorized whenNotPaused {
        // Calculate XP: XP = yieldAmount * xpMultiplier / PRECISION
        uint256 xpAwarded = (yieldAmount * xpMultiplier) / PRECISION;
        
        // Update cumulative XP
        uint256 oldXP = userXP[user];
        uint256 newXP = oldXP + xpAwarded;
        userXP[user] = newXP;
        
        // Emit XPEarned event
        emit XPEarned(user, yieldAmount, xpAwarded, newXP);
        
        // Check for level up (will be implemented in next sub-task)
        _checkAndUpdateLevel(user, oldXP, newXP);
    }

    /**
     * @notice Internal function to check and update user level
     * @dev Checks if user crossed level threshold and triggers badge minting
     * @param user Address of the user
     * @param oldXP Previous XP amount
     * @param newXP New XP amount
     */
    function _checkAndUpdateLevel(address user, uint256 oldXP, uint256 newXP) internal {
        uint256 oldLevel = _calculateLevel(oldXP);
        uint256 newLevel = _calculateLevel(newXP);
        
        // If level increased, update and emit event
        if (newLevel > oldLevel) {
            userLevel[user] = newLevel;
            emit LevelUp(user, newLevel, newXP);
            
            // Trigger badge minting for level-based badges
            if (badgeNFT != address(0)) {
                // Check if user crossed level 5 threshold
                if (newLevel >= 5 && oldLevel < 5) {
                    // Mint Level 5 badge
                    try IBadgeNFT(badgeNFT).mint(user, BADGE_LEVEL_5) {} catch {}
                }
                // Check if user crossed level 10 threshold
                if (newLevel >= 10 && oldLevel < 10) {
                    // Mint Level 10 badge
                    try IBadgeNFT(badgeNFT).mint(user, BADGE_LEVEL_10) {} catch {}
                }
            }
        }
    }

    /**
     * @notice Calculate level based on XP amount
     * @dev Returns the highest level where threshold <= xp
     * @param xp Amount of XP
     * @return level The calculated level (1-based)
     */
    function _calculateLevel(uint256 xp) internal view returns (uint256 level) {
        level = 1; // Start at level 1
        
        // Find the highest level where threshold <= xp
        for (uint256 i = levelThresholds.length - 1; i > 0; i--) {
            if (xp >= levelThresholds[i]) {
                level = i + 1; // Levels are 1-based, array is 0-based
                break;
            }
        }
        
        return level;
    }

    // View functions

    /**
     * @notice Get the current XP for a user
     * @param user Address of the user
     * @return Current XP amount
     */
    function getXP(address user) external view returns (uint256) {
        return userXP[user];
    }

    /**
     * @notice Get the current level for a user
     * @param user Address of the user
     * @return Current level (1-based)
     */
    function getLevel(address user) external view returns (uint256) {
        uint256 xp = userXP[user];
        if (xp == 0) {
            return 1; // Default to level 1
        }
        return _calculateLevel(xp);
    }

    /**
     * @notice Get the XP required to reach the next level
     * @param user Address of the user
     * @return XP needed for next level (0 if at max level)
     */
    function getXPToNextLevel(address user) external view returns (uint256) {
        uint256 currentXP = userXP[user];
        uint256 currentLevel = _calculateLevel(currentXP);
        
        // If at max level, return 0
        if (currentLevel >= levelThresholds.length) {
            return 0;
        }
        
        // Return XP needed to reach next level
        uint256 nextLevelThreshold = levelThresholds[currentLevel]; // currentLevel is 1-based, array is 0-based
        return nextLevelThreshold > currentXP ? nextLevelThreshold - currentXP : 0;
    }

    /**
     * @notice Get the XP threshold for a specific level
     * @param level Level to query (1-based)
     * @return XP threshold for the level
     */
    function getLevelThreshold(uint256 level) external view returns (uint256) {
        if (level == 0 || level > levelThresholds.length) {
            return 0;
        }
        return levelThresholds[level - 1]; // Convert 1-based level to 0-based array index
    }

    // Admin functions

    /**
     * @notice Set the XP multiplier
     * @dev Only callable by owner
     * @param _multiplier New XP multiplier (scaled by PRECISION)
     */
    function setXPMultiplier(uint256 _multiplier) external onlyOwner {
        if (_multiplier == 0) revert InvalidMultiplier();
        uint256 oldMultiplier = xpMultiplier;
        xpMultiplier = _multiplier;
        emit XPMultiplierUpdated(oldMultiplier, _multiplier);
    }

    /**
     * @notice Set level thresholds
     * @dev Only callable by owner. Thresholds must be monotonically increasing
     * @param _thresholds Array of XP thresholds for each level
     */
    function setLevelThresholds(uint256[] calldata _thresholds) external onlyOwner {
        if (_thresholds.length == 0) revert InvalidThresholds();
        
        // Check that thresholds are monotonically increasing
        for (uint256 i = 1; i < _thresholds.length; i++) {
            if (_thresholds[i] <= _thresholds[i - 1]) {
                revert InvalidThresholds();
            }
        }
        
        // First threshold must be 0
        if (_thresholds[0] != 0) revert InvalidThresholds();
        
        // Update thresholds
        delete levelThresholds;
        for (uint256 i = 0; i < _thresholds.length; i++) {
            levelThresholds.push(_thresholds[i]);
        }
        
        emit LevelThresholdsUpdated(_thresholds);
    }

    /**
     * @notice Set the BadgeNFT contract address
     * @dev Only callable by owner
     * @param _badgeNFT Address of the BadgeNFT contract
     */
    function setBadgeNFT(address _badgeNFT) external onlyOwner {
        address oldBadgeNFT = badgeNFT;
        badgeNFT = _badgeNFT;
        emit BadgeNFTUpdated(oldBadgeNFT, _badgeNFT);
    }

    /**
     * @notice Set the QuestVault contract address
     * @dev Only callable by owner
     * @param _questVault Address of the QuestVault contract
     */
    function setQuestVault(address _questVault) external onlyOwner {
        address oldVault = questVault;
        questVault = _questVault;
        emit QuestVaultUpdated(oldVault, _questVault);
    }

    /**
     * @notice Pause the contract
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
