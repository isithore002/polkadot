#!/bin/bash
cd /home/agnel/pvmark/contracts/evm-solidity
export PATH=$PATH:/home/agnel/bin
mkdir -p bin
npx resolc --bin contracts/PVMark.sol -o bin
