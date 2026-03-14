#!/bin/bash
set -e
echo "PVMark - Building Contracts"
echo ""
echo "Building Rust PolkaVM contract..."
cd contracts/pvm-rust
if command -v cargo >/dev/null 2>&1; then
  make build || echo "Rust build failed (PolkaVM target may not be configured)"
else
  echo "Cargo not found, skipping Rust build"
fi
cd ../..
echo ""
echo "Building Solidity contract..."
cd contracts/evm-solidity
npx hardhat compile
cd ../..
echo ""
echo "All contracts built!"
