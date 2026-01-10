# YieldQuest Smart Contracts

YieldQuest is a GameFi × Social × DeFi protocol on Mantle Network that transforms real DeFi yield into a social, competitive game experience.

## Project Structure

```
smart-contracts/
├── contracts/          # Solidity smart contracts
├── test/              # Test files (TypeScript)
├── scripts/           # Deployment and utility scripts
├── deploy/            # Deployment configurations
├── ignition/          # Hardhat Ignition modules
└── typechain-types/   # Generated TypeScript types
```

## Technology Stack

- **Solidity**: 0.8.20+
- **Framework**: Hardhat 2.x
- **Testing**: Chai + Mocha
- **Libraries**: OpenZeppelin 5.x
- **Network**: Mantle Sepolia (Testnet)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

3. Compile contracts:
```bash
npm run build
```

## Testing

Run all tests:
```bash
npm test
```

Run tests with gas reporting:
```bash
REPORT_GAS=true npm test
```

Run tests with coverage:
```bash
npx hardhat coverage
```

## Deployment

Deploy to Mantle Sepolia:
```bash
npm run deploy -- --network mantleSepolia
```

Verify contracts:
```bash
npm run verify -- --network mantleSepolia <CONTRACT_ADDRESS>
```

## Contract Architecture

The YieldQuest protocol consists of four core contracts:

1. **BadgeNFT**: Soulbound achievement NFTs
2. **XPManager**: XP calculation and level progression
3. **QuestVault**: ERC-4626 vault for yield generation
4. **LeaderboardSnapshot**: Periodic ranking snapshots

## Development

- All contracts follow OpenZeppelin standards
- Tests are written in TypeScript using Hardhat + ethers + chai
- Property-based testing validates correctness properties
- Anti-mock principle: Real yield simulation, no fake APR

## License

MIT
