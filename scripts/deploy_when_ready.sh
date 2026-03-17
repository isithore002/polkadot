#!/bin/bash
# Polls known RPC endpoints, updates .env with the first live one, then deploys and benchmarks.
set -e

ENDPOINTS=(
  "https://eth-rpc-testnet.polkadot.io"
  "https://testnet-passet-hub-eth-rpc.polkadot.io"
)
ENV_FILE="$(dirname "$0")/../.env"

echo "Checking RPC endpoints..."
WORKING_URL=""
for url in "${ENDPOINTS[@]}"; do
  result=$(curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    --max-time 8 2>/dev/null)
  if echo "$result" | grep -q '"result"'; then
    WORKING_URL="$url"
    echo "Live: $url"
    break
  else
    echo "Down: $url"
  fi
done

if [ -z "$WORKING_URL" ]; then
  echo "All endpoints down. Try again in 10 minutes."
  exit 1
fi

sed -i "s|WESTEND_RPC=.*|WESTEND_RPC=$WORKING_URL|" "$ENV_FILE"
echo "Updated .env → $WORKING_URL"

cd "$(dirname "$0")/.."
npm run deploy && npm run benchmark
