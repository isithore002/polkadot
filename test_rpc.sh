#!/bin/bash
echo "Testing primary RPC..."
curl -s -m 10 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://services.polkadothub-rpc.com/testnet/
echo ""

echo "Testing official RPC..."
curl -s -m 10 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://eth-rpc-testnet.polkadot.io
echo ""
