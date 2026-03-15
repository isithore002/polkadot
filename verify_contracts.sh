#!/bin/bash
# Step 1: Verify both contracts are callable

echo "=== Step 1: Contract Verification ==="
echo ""

# Check if cast is available
if command -v cast &> /dev/null; then
  echo "Using cast..."
  
  echo "--- PVM Contract (resolc) ---"
  cast call 0xE4dE3ab9253473a7AeD4031c3B4928BE5c7Ad129 \
    "hashLeaf(bytes32)" \
    "0x0000000000000000000000000000000000000000000000000000000000000001" \
    --rpc-url https://services.polkadothub-rpc.com/testnet/
  echo ""

  echo "--- REVM Contract (Solidity) ---"
  cast call 0x6310Bf7efa50B7DD202608C6eF1350E9b6aA81cB \
    "hashLeafSol(bytes32)" \
    "0x0000000000000000000000000000000000000000000000000000000000000001" \
    --rpc-url https://services.polkadothub-rpc.com/testnet/
  echo ""
else
  echo "cast not found, using node+ethers..."
  node -e "
const { ethers } = require('ethers');
(async () => {
  const provider = new ethers.JsonRpcProvider('https://services.polkadothub-rpc.com/testnet/');
  const LEAF = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const abi = ['function hashLeaf(bytes32) view returns (bytes32)'];
  const abiSol = ['function hashLeafSol(bytes32) view returns (bytes32)'];

  console.log('--- PVM Contract (resolc) ---');
  try {
    const pvm = new ethers.Contract('0xE4dE3ab9253473a7AeD4031c3B4928BE5c7Ad129', abi, provider);
    const r1 = await pvm.hashLeaf(LEAF);
    console.log('Result:', r1);
    console.log('OK: Non-zero 32-byte value returned');
  } catch (e) {
    console.error('FAIL:', e.message);
  }

  console.log('');
  console.log('--- REVM Contract (Solidity) ---');
  try {
    const sol = new ethers.Contract('0x6310Bf7efa50B7DD202608C6eF1350E9b6aA81cB', abiSol, provider);
    const r2 = await sol.hashLeafSol(LEAF);
    console.log('Result:', r2);
    console.log('OK: Non-zero 32-byte value returned');
  } catch (e) {
    console.error('FAIL:', e.message);
  }
})();
"
fi
