// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IXPManager {
    function awardXP(address user, uint256 yieldAmount) external;
}

/**
 * @title QuestVault
 * @notice ERC-4626 compliant vault for YieldQuest that generates real yield
 * @dev Handles deposits, withdrawals, and triggers XP awards on yield realization
 */
contract QuestVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    // State variables
    mapping(address => uint256) public depositTimestamp;
    mapping(address => uint256) public lastClaimedAssets; // Asset-equivalent share value at last claim
    
    address public xpManager;

    // Custom errors
    error ZeroDeposit();
    error InsufficientShares(uint256 requested, uint256 available);
    error ContractPaused();
    error NotPaused();
    error Unauthorized();

    // Events
    event YieldAccrued(address indexed user, uint256 yieldAmount, uint256 timestamp);
    event XPManagerUpdated(address indexed oldManager, address indexed newManager);

    /**
     * @notice Constructor
     * @param asset_ Address of the underlying ERC20 asset
     * @param name_ Name of the vault shares token
     * @param symbol_ Symbol of the vault shares token
     * @param initialOwner Address of the contract owner
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(initialOwner) {}

    /**
     * @notice Modifier to check if contract is not paused
     */
    modifier whenNotPausedCustom() {
        if (paused()) revert ContractPaused();
        _;
    }

    // Core vault functions

    /**
     * @notice Deposit assets into the vault
     * @dev Overrides ERC4626 deposit to add timestamp tracking and pause check
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive the shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        whenNotPausedCustom
        returns (uint256 shares)
    {
        // Check for zero deposit
        if (assets == 0) revert ZeroDeposit();

        // Call parent deposit function
        shares = super.deposit(assets, receiver);

        // Track deposit timestamp
        depositTimestamp[receiver] = block.timestamp;

        // CRITICAL FIX: Always sync lastClaimedAssets to prevent deposit-as-yield bug
        // This ensures additional deposits don't get counted as realized yield
        lastClaimedAssets[receiver] = convertToAssets(balanceOf(receiver));

        return shares;
    }

    /**
     * @notice Mint shares from the vault
     * @dev Overrides ERC4626 mint to add timestamp tracking and pause check
     * @param shares Amount of shares to mint
     * @param receiver Address to receive the shares
     * @return assets Amount of assets deposited
     */
    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        whenNotPausedCustom
        returns (uint256 assets)
    {
        // Check for zero shares
        if (shares == 0) revert ZeroDeposit();

        // Call parent mint function
        assets = super.mint(shares, receiver);

        // Track deposit timestamp
        depositTimestamp[receiver] = block.timestamp;

        // CRITICAL FIX: Always sync lastClaimedAssets to prevent deposit-as-yield bug
        // This ensures additional deposits don't get counted as realized yield
        lastClaimedAssets[receiver] = convertToAssets(balanceOf(receiver));

        return assets;
    }

    /**
     * @notice Withdraw assets from the vault
     * @dev Overrides ERC4626 withdraw to calculate and award XP for realized yield
     * @dev Allows withdrawal even when paused (emergency exit)
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive the assets
     * @param owner Address of the share owner
     * @return shares Amount of shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        // Calculate current asset value of user's shares before withdrawal
        uint256 userShares = balanceOf(owner);
        uint256 currentAssets = convertToAssets(userShares);
        
        // Calculate realized yield
        uint256 lastClaimed = lastClaimedAssets[owner];
        uint256 realizedYield = 0;
        
        if (currentAssets > lastClaimed) {
            realizedYield = currentAssets - lastClaimed;
        }

        // Call parent withdraw function
        shares = super.withdraw(assets, receiver, owner);

        // Award XP if yield was realized and xpManager is set
        if (realizedYield > 0 && xpManager != address(0)) {
            try IXPManager(xpManager).awardXP(owner, realizedYield) {} catch {}
            emit YieldAccrued(owner, realizedYield, block.timestamp);
        }

        // Update lastClaimedAssets to current value after withdrawal
        uint256 remainingShares = balanceOf(owner);
        lastClaimedAssets[owner] = convertToAssets(remainingShares);

        return shares;
    }

    /**
     * @notice Redeem shares from the vault
     * @dev Overrides ERC4626 redeem to calculate and award XP for realized yield
     * @dev Allows redemption even when paused (emergency exit)
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive the assets
     * @param owner Address of the share owner
     * @return assets Amount of assets withdrawn
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        // Calculate current asset value of user's shares before redemption
        uint256 userShares = balanceOf(owner);
        uint256 currentAssets = convertToAssets(userShares);
        
        // Calculate realized yield
        uint256 lastClaimed = lastClaimedAssets[owner];
        uint256 realizedYield = 0;
        
        if (currentAssets > lastClaimed) {
            realizedYield = currentAssets - lastClaimed;
        }

        // Call parent redeem function
        assets = super.redeem(shares, receiver, owner);

        // Award XP if yield was realized and xpManager is set
        if (realizedYield > 0 && xpManager != address(0)) {
            try IXPManager(xpManager).awardXP(owner, realizedYield) {} catch {}
            emit YieldAccrued(owner, realizedYield, block.timestamp);
        }

        // Update lastClaimedAssets to current value after redemption
        uint256 remainingShares = balanceOf(owner);
        lastClaimedAssets[owner] = convertToAssets(remainingShares);

        return assets;
    }

    /**
     * @notice Claim yield without withdrawing principal
     * @dev Calculates realized yield and awards XP without burning shares
     * @return yieldAmount Amount of yield claimed
     */
    function claimYield() external nonReentrant returns (uint256 yieldAmount) {
        address user = msg.sender;
        
        // Calculate current asset value of user's shares
        uint256 userShares = balanceOf(user);
        uint256 currentAssets = convertToAssets(userShares);
        
        // Calculate realized yield
        uint256 lastClaimed = lastClaimedAssets[user];
        
        if (currentAssets > lastClaimed) {
            yieldAmount = currentAssets - lastClaimed;
        } else {
            yieldAmount = 0;
        }

        // Award XP if yield was realized and xpManager is set
        if (yieldAmount > 0 && xpManager != address(0)) {
            try IXPManager(xpManager).awardXP(user, yieldAmount) {} catch {}
            emit YieldAccrued(user, yieldAmount, block.timestamp);
        }

        // Update lastClaimedAssets to current value
        lastClaimedAssets[user] = currentAssets;

        return yieldAmount;
    }

    // View functions

    /**
     * @notice Get the current unrealized yield for a user
     * @param user Address of the user
     * @return Unrealized yield amount
     */
    function getUserYield(address user) external view returns (uint256) {
        uint256 userShares = balanceOf(user);
        uint256 currentAssets = convertToAssets(userShares);
        uint256 lastClaimed = lastClaimedAssets[user];
        
        if (currentAssets > lastClaimed) {
            return currentAssets - lastClaimed;
        }
        
        return 0;
    }

    // Admin functions

    /**
     * @notice Set the XPManager contract address
     * @dev Only callable by owner
     * @param _xpManager Address of the XPManager contract
     */
    function setXPManager(address _xpManager) external onlyOwner {
        address oldManager = xpManager;
        xpManager = _xpManager;
        emit XPManagerUpdated(oldManager, _xpManager);
    }

    /**
     * @notice Pause the contract
     * @dev Only callable by owner. Blocks deposits but allows withdrawals
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        if (!paused()) revert NotPaused();
        _unpause();
    }
}
