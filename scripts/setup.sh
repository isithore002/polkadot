#!/bin/bash
set -e
echo "PVMark - Project Setup"
echo ""
command -v node >/dev/null 2>&1 || { echo "Node.js not found."; exit 1; }
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "Rust: $(rustc --version 2>/dev/null || echo 'not installed')"
echo ""
echo "Installing Node dependencies..."
npm install
echo ""
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  printf "PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000\nWESTEND_RPC=https://eth-rpc-testnet.polkadot.io\nNETWORK=polkadotHubTestnet\nPVMARK_SOLIDITY_ADDRESS=\nPVMARK_RUST_ADDRESS=\n" > .env
  echo "Update .env with your private key before deploying!"
fi
echo ""
echo "Setup complete!"
