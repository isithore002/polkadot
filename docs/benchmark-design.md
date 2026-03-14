# Benchmark Design

## Operations

| Operation     | Description                |
|---------------|----------------------------|
| hashLeaf      | Single keccak256 hash      |
| hashPair      | Hash two concatenated vals |
| verifyProof   | Merkle proof verification  |
| storageWrite  | Storage slot write         |
| storageRead   | Storage slot read          |
| fibonacci     | Compute n-th Fibonacci     |

## Expected Results

Rust contracts are expected to be 50-75% cheaper than Solidity equivalents:
- RISC-V native execution (no bytecode interpretation)
- No EVM overhead (skip opcode dispatch)
- Compiler optimizations (Rust/LLVM)
- Efficient memory model
