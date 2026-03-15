#!/bin/bash
cd /home/agnel/pvmark/contracts/evm-solidity
export PATH=$PATH:/home/agnel/bin
RESOLC=../../node_modules/.bin/resolc
$RESOLC --bin --abi --solc /home/agnel/bin/solc contracts/PVMark.sol -o bin > resolc_full_output.txt 2>&1
