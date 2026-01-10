# YieldQuest Deployment Scripts

This directory contains scripts for deploying, configuring, and verifying the YieldQuest smart contracts.

## Prerequisites

1. Set up your `.env` file with the following variables:
   ```
   PRIVATE_KEY=your_private_key_here
   MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
   ETHERSCAN_API_KEY=your_etherscan_api_key_here
   ```

2. Ensure you have sufficient MNT tokens on Mantle Sepolia for deployment gas fees.

## Deployment Process

### Step 1: Deploy Contracts

Deploy all contracts in the correct order (BadgeNFT → XPManager → QuestVault → LeaderboardSnapshot):

```bash
npx hardhat run scripts/deploy.ts --network mantleSepolia
```

This will:
- Deploy TestUSDC (mock underlying asset)
- Deploy BadgeNFT (no dependencies)
- Deploy XPManager (with BadgeNFT address)
- Deploy QuestVault (with TestUSDC and XPManager addresses)
- Deploy LeaderboardSnapshot (with XPManager address)
- Save deployment addresses to `deployments/<network>-<chainId>.json`

### Step 2: Configure Contracts

Configure the deployed contracts with proper settings:

```bash
npx hardhat run scripts/configure.ts --network mantleSepolia
```

This will:
- Set XPManager.questVault to QuestVault address
- Set BadgeNFT.xpManager to XPManager address
- Set level thresholds: [0, 100, 350, 850, 1850, 3850, 7850, 15850, 31850, 63850]
- Set XP multiplier to 100 (100 XP per 1 token yield)
- Set LeaderboardSnapshot.maxEntriesPerSnapshot to 100
- Verify all configurations

### Step 3: Verify Contracts

Verify all contracts on the Mantle Sepolia block explorer:

```bash
npx hardhat run scripts/verify.ts --network mantleSepolia
```

This will:
- Verify all contracts on the block explorer
- Export ABIs to `abis/*.json` for frontend integration
- Create `deployments.json` with comprehensive deployment information
- Display block explorer links for all contracts

## Local Testing

To test the deployment scripts locally on Hardhat network:

```bash
# Start local Hardhat node
npx hardhat node

# In another terminal, deploy to local network
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/configure.ts --network localhost
```

Note: Verification is not available on local networks.

## Output Files

After running all scripts, you'll have:

- `deployments/<network>-<chainId>.json` - Deployment addresses and metadata
- `deployments.json` - Comprehensive deployment info with ABI paths
- `abis/*.json` - Contract ABIs for frontend integration

## Frontend Integration

Use the generated files for frontend integration:

```typescript
import deployments from './deployments.json';
import QuestVaultABI from './abis/QuestVault.json';

const questVaultAddress = deployments.contracts.QuestVault.address;
const questVaultABI = QuestVaultABI;
```

## Troubleshooting

### "Deployment file not found"
- Run `deploy.ts` first before running `configure.ts` or `verify.ts`

### "Insufficient funds"
- Ensure your wallet has enough MNT tokens on Mantle Sepolia
- Get testnet tokens from the Mantle Sepolia faucet

### "Already Verified"
- This is normal if you're re-running the verification script
- The script will skip already verified contracts

### Verification fails
- Check that your ETHERSCAN_API_KEY is set correctly in `.env`
- Ensure the Mantle Sepolia explorer API is accessible
- Wait a few minutes after deployment before verifying

## Contract Deployment Order

The deployment order is critical due to dependencies:

1. **TestUSDC** - No dependencies (mock ERC20 token)
2. **BadgeNFT** - No dependencies (soulbound NFT)
3. **XPManager** - Requires BadgeNFT address
4. **QuestVault** - Requires TestUSDC and XPManager addresses
5. **LeaderboardSnapshot** - Requires XPManager address

## Configuration Details

### Level Thresholds
| Level | XP Required | Cumulative XP |
|-------|-------------|---------------|
| 1     | 0           | 0             |
| 2     | 100         | 100           |
| 3     | 250         | 350           |
| 4     | 500         | 850           |
| 5     | 1000        | 1850          |
| 6     | 2000        | 3850          |
| 7     | 4000        | 7850          |
| 8     | 8000        | 15850         |
| 9     | 16000       | 31850         |
| 10    | 32000       | 63850         |

### XP Multiplier
- Default: 100
- Meaning: 100 XP per 1 token of yield
- Example: 10 USDC yield = 1000 XP

### Leaderboard Settings
- Max entries per snapshot: 100
- Snapshots are created manually by admin
