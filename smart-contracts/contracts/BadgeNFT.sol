// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BadgeNFT
 * @notice Soulbound NFT contract for YieldQuest achievements
 * @dev Non-transferable badges that represent on-chain accomplishments
 */
contract BadgeNFT is ERC721, Ownable {
    // Badge type constants
    uint256 public constant BADGE_EARLY_ADOPTER = 1;
    uint256 public constant BADGE_FIRST_DEPOSIT = 2;
    uint256 public constant BADGE_LEVEL_5 = 3;
    uint256 public constant BADGE_LEVEL_10 = 4;
    uint256 public constant BADGE_YIELD_MASTER = 5;

    // State variables
    mapping(address => mapping(uint256 => bool)) public hasBadge; // user => badgeType => owned
    mapping(address => uint256[]) private _userBadges; // user => list of badge types
    mapping(uint256 => string) public badgeMetadata; // badgeType => metadata URI
    
    address public xpManager;
    uint256 private _nextTokenId;

    // Custom errors
    error SoulboundTransferProhibited();
    error BadgeAlreadyOwned(address user, uint256 badgeType);
    error OnlyXPManager();
    error OnlyOwner();

    // Events
    event BadgeMinted(
        address indexed user,
        uint256 indexed badgeType,
        uint256 tokenId,
        uint256 timestamp
    );
    event XPManagerUpdated(address indexed oldManager, address indexed newManager);
    event BadgeMetadataUpdated(uint256 indexed badgeType, string uri);

    /**
     * @notice Constructor
     * @param initialOwner Address of the contract owner
     */
    constructor(address initialOwner) ERC721("YieldQuest Badge", "YQBADGE") Ownable(initialOwner) {
        _nextTokenId = 1;
    }

    /**
     * @notice Modifier to restrict access to XPManager or owner
     */
    modifier onlyXPManager() {
        if (msg.sender != xpManager && msg.sender != owner()) {
            revert OnlyXPManager();
        }
        _;
    }

    // Soulbound transfer restrictions - override internal update function
    
    /**
     * @notice Override _update to prevent all transfers except minting
     * @dev Reverts on any transfer that is not a mint (from == address(0))
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0))
        // Block all other transfers
        if (from != address(0)) {
            revert SoulboundTransferProhibited();
        }
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Override approve to prevent approvals (soulbound)
     * @dev Always reverts with SoulboundTransferProhibited
     */
    function approve(address /* to */, uint256 /* tokenId */) public pure override {
        revert SoulboundTransferProhibited();
    }

    /**
     * @notice Override setApprovalForAll to prevent approvals (soulbound)
     * @dev Always reverts with SoulboundTransferProhibited
     */
    function setApprovalForAll(address /* operator */, bool /* approved */) public pure override {
        revert SoulboundTransferProhibited();
    }

    // Badge minting logic

    /**
     * @notice Mint a badge to a user
     * @dev Only callable by XPManager or owner
     * @param to Address to mint the badge to
     * @param badgeType Type of badge to mint
     */
    function mint(address to, uint256 badgeType) external onlyXPManager {
        // Check for duplicate badges
        if (hasBadge[to][badgeType]) {
            revert BadgeAlreadyOwned(to, badgeType);
        }

        // Mint the NFT
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // Update mappings
        hasBadge[to][badgeType] = true;
        _userBadges[to].push(badgeType);

        // Emit event
        emit BadgeMinted(to, badgeType, tokenId, block.timestamp);
    }

    // View functions

    /**
     * @notice Get all badges owned by a user
     * @param user Address of the user
     * @return Array of badge types owned by the user
     */
    function getBadges(address user) external view returns (uint256[] memory) {
        return _userBadges[user];
    }

    /**
     * @notice Check if a user has a specific badge type
     * @param user Address of the user
     * @param badgeType Type of badge to check
     * @return True if user owns the badge type
     */
    function hasBadgeType(address user, uint256 badgeType) external view returns (bool) {
        return hasBadge[user][badgeType];
    }

    // Admin functions

    /**
     * @notice Set the XPManager address
     * @dev Only callable by owner
     * @param _xpManager Address of the XPManager contract
     */
    function setXPManager(address _xpManager) external onlyOwner {
        address oldManager = xpManager;
        xpManager = _xpManager;
        emit XPManagerUpdated(oldManager, _xpManager);
    }

    /**
     * @notice Set metadata URI for a badge type
     * @dev Only callable by owner
     * @param badgeType Type of badge
     * @param uri Metadata URI
     */
    function setBadgeMetadata(uint256 badgeType, string calldata uri) external onlyOwner {
        badgeMetadata[badgeType] = uri;
        emit BadgeMetadataUpdated(badgeType, uri);
    }
}
