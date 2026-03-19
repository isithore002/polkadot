#!/bin/bash
set -e
source .env

echo "🚀 Deploying PVMark wrapper with PVM address: $PVMARK_RUST_ADDRESS"
echo ""

cd contracts/evm-solidity

# Deploy wrapper pointing to the PVM contract
npx hardhat run --network $NETWORK scripts/deploy-wrapper-only.ts

cd ../..
echo ""
echo "✅ Deployment complete!"
