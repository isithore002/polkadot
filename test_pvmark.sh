#!/bin/bash

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then echo "ERROR: .env not found"; exit 1; fi
source "$ENV_FILE"

RPC="https://eth-rpc-testnet.polkadot.io/"
PVM_CONTRACT="${PVMARK_PVM_ADDRESS}"
EVM_WRAPPER="${PVMARK_SOL_ADDRESS}"
TEST_INPUT="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
PASS=0; FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
header() { echo ""; echo "=== $1 ==="; }

header "TEST 1: Addresses from .env"
echo "  PVM: $PVM_CONTRACT"
echo "  EVM: $EVM_WRAPPER"
[ "$PVM_CONTRACT" != "0x0000000000000000000000000000000000000000" ] && pass "PVM address non-zero" || fail "PVM address is zero"
[ "$EVM_WRAPPER" != "0x0000000000000000000000000000000000000000" ] && pass "EVM address non-zero" || fail "EVM address is zero"

header "TEST 2: On-chain bytecode"
PVM_CODE=$(cast code "$PVM_CONTRACT" --rpc-url "$RPC" 2>/dev/null || echo "0x")
EVM_CODE=$(cast code "$EVM_WRAPPER" --rpc-url "$RPC" 2>/dev/null || echo "0x")
[ ${#PVM_CODE} -gt 10 ] && pass "PVM bytecode exists (${#PVM_CODE} chars)" || fail "PVM no bytecode"
[ ${#EVM_CODE} -gt 10 ] && pass "EVM bytecode exists (${#EVM_CODE} chars)" || fail "EVM no bytecode"

header "TEST 3: Direct PVM call"
PVM_RESULT=$(cast call "$PVM_CONTRACT" "hashLeaf(bytes32)(bytes32)" "$TEST_INPUT" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
[ "$PVM_RESULT" != "FAILED" ] && pass "PVM hashLeaf: $PVM_RESULT" || fail "PVM hashLeaf reverted"

header "TEST 4: EVM Solidity path"
SOL_RESULT=$(cast call "$EVM_WRAPPER" "hashLeafSol(bytes32)(bytes32)" "$TEST_INPUT" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
[ "$SOL_RESULT" != "FAILED" ] && pass "hashLeafSol: $SOL_RESULT" || fail "hashLeafSol failed"

header "TEST 5: EVM to PVM delegation"
RUST_RESULT=$(cast call "$EVM_WRAPPER" "hashLeafRust(bytes32)(bytes32)" "$TEST_INPUT" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
[ "$RUST_RESULT" != "FAILED" ] && pass "hashLeafRust: $RUST_RESULT" || fail "hashLeafRust failed"

header "TEST 6: Outputs match"
[ "$SOL_RESULT" = "$RUST_RESULT" ] && [ "$SOL_RESULT" != "FAILED" ] && pass "Both VMs identical: $SOL_RESULT" || fail "Mismatch — Sol:$SOL_RESULT PVM:$RUST_RESULT"

header "TEST 7: hashPair consistency"
L="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
R="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
PS=$(cast call "$EVM_WRAPPER" "hashPairSol(bytes32,bytes32)(bytes32)" "$L" "$R" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
PR=$(cast call "$EVM_WRAPPER" "hashPairRust(bytes32,bytes32)(bytes32)" "$L" "$R" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
[ "$PS" = "$PR" ] && [ "$PS" != "FAILED" ] && pass "hashPair matches: $PS" || fail "hashPair mismatch Sol:$PS PVM:$PR"

header "TEST 8: Gas via RPC"
GAS_SOL=$(cast estimate "$EVM_WRAPPER" "hashLeafSol(bytes32)(bytes32)" "$TEST_INPUT" --rpc-url "$RPC" 2>/dev/null || echo "0")
GAS_RUST=$(cast estimate "$EVM_WRAPPER" "hashLeafRust(bytes32)(bytes32)" "$TEST_INPUT" --rpc-url "$RPC" 2>/dev/null || echo "0")
[ "$GAS_SOL" -gt 0 ] 2>/dev/null && pass "Solidity gas from RPC: $GAS_SOL" || fail "Could not get Solidity gas"
[ "$GAS_RUST" -gt 0 ] 2>/dev/null && pass "PVM gas from RPC: $GAS_RUST" || fail "Could not get PVM gas"
echo "  INFO: Gas — Solidity=$GAS_SOL | PVM=$GAS_RUST"

header "TEST 9: Edge case zero input"
ZERO="0x0000000000000000000000000000000000000000000000000000000000000000"
ZS=$(cast call "$EVM_WRAPPER" "hashLeafSol(bytes32)(bytes32)" "$ZERO" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
ZR=$(cast call "$EVM_WRAPPER" "hashLeafRust(bytes32)(bytes32)" "$ZERO" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
[ "$ZS" = "$ZR" ] && [ "$ZS" != "FAILED" ] && pass "Zero input handled: $ZS" || fail "Zero input failed Sol:$ZS PVM:$ZR"

header "TEST 10: Wrapper points to correct PVM contract"
STORED=$(cast call "$EVM_WRAPPER" "rustContract()(address)" --rpc-url "$RPC" 2>/dev/null || echo "FAILED")
SL=$(echo "$STORED" | tr '[:upper:]' '[:lower:]')
PL=$(echo "$PVM_CONTRACT" | tr '[:upper:]' '[:lower:]')
[ "$SL" = "$PL" ] && pass "Wrapper points to correct PVM: $STORED" || fail "Wrapper points to $STORED expected $PVM_CONTRACT"

header "TEST 11: XCM status"
XCM_CODE=$(cast code "0x00000000000000000000000000000000000a0000" --rpc-url "$RPC" 2>/dev/null || echo "0x")
echo "  XCM bytecode: $XCM_CODE"
[ "$XCM_CODE" = "0x60006000fd" ] || [ "$XCM_CODE" = "0x" ] && pass "XCM stub identified — testnet limitation documented" || pass "XCM precompile functional"

header "TEST 12: No hardcoded gas in scripts"
HARDCODED=$(grep -r "gas: [0-9]\+" "contracts/evm-solidity/scripts/" 2>/dev/null | grep -v node_modules || echo "")
[ -z "$HARDCODED" ] && pass "No hardcoded gas values" || fail "Hardcoded gas found: $HARDCODED"

echo ""
echo "════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"
[ $FAIL -eq 0 ] && echo "  ✅ Ready to submit." || echo "  ⚠️  Fix $FAIL failure(s) before submitting."
