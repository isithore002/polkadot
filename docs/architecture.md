# PVMark Architecture

## System Overview

PVMark compares gas costs between PolkaVM (Rust) and EVM (Solidity) on Polkadot Asset Hub.

```
Contracts (Rust + Solidity) --> Benchmark Scripts --> JSON Results --> React Dashboard
```

## Benchmark Flow

1. Deploy both contracts to Asset Hub
2. Call each benchmark function on both contracts
3. Record gas (EVM) and ref_time (PVM)
4. Write results to data/benchmark-results.json
5. Dashboard reads JSON and renders charts

## Design Decisions

- Monorepo with npm workspaces for unified dependency management
- JSON data layer for simple benchmark results sharing
- Makefile for Rust builds (cargo doesn't integrate with npm)
- Separate SDK package for shared contract ABIs and network config
