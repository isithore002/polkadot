# PVMark
PolkaVM vs EVM Benchmark Suite for Polkadot Asset Hub

## Benchmark Results (Live on Polkadot Hub Testnet)

Both contracts implement identical cryptographic logic via two different compilers targeting two different VMs. REVM: Solidity source compiled with `solc` to EVM bytecode. PVM: same Solidity source compiled with `resolc` to PolkaVM RISC-V bytecode. Gas values are Polkadot Asset Hub `ref_time` computation units, not EVM gas.

| Function      | REVM Gas | PVM Gas | Delta  | % Diff  | Finding                 |
|---------------|----------|---------|--------|---------|-------------------------|
| hashLeaf      | 1,044    | 1,102   | +58    | +5.6%   | Fixed dispatch overhead |
| hashPair      | 1,210    | 1,268   | +58    | +4.8%   | Fixed dispatch overhead |
| verifyProof   | 2,185    | 2,243   | +58    | +2.7%   | Fixed dispatch overhead |
| **hashChain** | **1,908**| **3,600**| **+1,692** | **+88.7%** | **Loop overhead compounds** |

> **Benchmark Finding (March 2026):**
> On the current Polkadot Hub Testnet, REVM outperforms PolkaVM for these cryptographic operations. PVMark measures a consistent **+58 gas fixed dispatch overhead** per call when crossing the Solidity→PolkaVM boundary, plus compounding per-iteration cost in loop-heavy operations. The `hashChain` benchmark (1,000 iterations) shows PVM costs **88.7% more** than REVM at scale — the clearest signal of the current call-dispatch overhead. This establishes the baseline from which PolkaVM optimisation progress can be measured.

**Contracts (chain 420420417)**
- PVM (resolc → PolkaVM RISC-V): `0xdB2ea32c654523F104f6c592020E1DE8C547b675`
- REVM (solc → EVM):             `0x3396a2BDd27391990DAcb33E97ed8063661EE274`

Reproduce: `npm run benchmark`

