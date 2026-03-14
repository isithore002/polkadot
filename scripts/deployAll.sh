#!/bin/bash
set -e
source .env 2>/dev/null || true
NETWORK=${NETWORK:-polkadotHubTestnet}

echo "╔══════════════════════════════════════════════════╗"
echo "║        🚀 PVMark — Deploying Contracts           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "🌐 Target network: $NETWORK"
echo ""

echo "📦 Deploying Solidity PVMark..."
cd contracts/evm-solidity
npm install >/dev/null 2>&1
npx hardhat run scripts/deploy.ts --network $NETWORK
cd ../..

echo ""
echo "✅ Deployment complete!"
