# Demo Script (5 minutes)

1. **Intro** (30s): "PVMark measures the real performance boundary between PolkaVM and REVM on Polkadot Hub Testnet"
2. **Architecture** (30s): Show system diagram
3. **Deploy** (60s): `npm run build && npm run deploy`
4. **Benchmark** (60s): `npm run benchmark && npm run gas:compare`
5. **Dashboard** (60s): `npm run dashboard`
6. **Takeaway** (60s): "REVM currently outperforms PolkaVM for this workload — a fixed +58 gas dispatch overhead per call, plus 88.7% higher cost on hashChain at 1,000 iterations. This is the performance baseline. As PolkaVM is optimised, these are the numbers to beat."
