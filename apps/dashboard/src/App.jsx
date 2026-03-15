import React, { useState, useEffect, useCallback } from 'react';
import contractAddresses from './contracts.json';
import cachedData from './benchmarkResults.json';

const RPC_URL = "https://eth-rpc-testnet.polkadot.io";

const BENCHMARK_ABI = [
  "function hashLeaf(bytes32 leaf) view returns (bytes32)",
  "function hashPair(bytes32 left, bytes32 right) view returns (bytes32)",
  "function verifyProof(bytes32 leaf, bytes32[] proof, bytes32 root) view returns (bool)",
];

const SOLIDITY_ABI = [
  "function hashLeafSol(bytes32 leaf) view returns (bytes32)",
  "function hashPairSol(bytes32 left, bytes32 right) view returns (bytes32)",
  "function verifyProofSol(bytes32 leaf, bytes32[] proof, bytes32 root) view returns (bool)",
];

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('cached');
  const [error, setError] = useState(null);

  // Load cached data on mount
  useEffect(() => {
    if (cachedData?.results) {
      setData(cachedData.results);
      setSource('cached');
    }
  }, []);

  // Fetch live data from testnet
  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(RPC_URL);

      const pvmAddr = contractAddresses.rust;
      const solAddr = contractAddresses.solidity;

      const pvmContract = new ethers.Contract(pvmAddr, BENCHMARK_ABI, provider);
      const solContract = new ethers.Contract(solAddr, SOLIDITY_ABI, provider);

      // Test data
      const LEAF = ethers.keccak256(ethers.toUtf8Bytes("pvmark-benchmark-leaf"));
      const LEFT = ethers.keccak256(ethers.toUtf8Bytes("left-node"));
      const RIGHT = ethers.keccak256(ethers.toUtf8Bytes("right-node"));

      // Build merkle proof
      const proofElements = [
        ethers.keccak256(ethers.toUtf8Bytes("sibling-1")),
        ethers.keccak256(ethers.toUtf8Bytes("sibling-2")),
        ethers.keccak256(ethers.toUtf8Bytes("sibling-3")),
        ethers.keccak256(ethers.toUtf8Bytes("sibling-4")),
      ];
      let hash = LEAF;
      for (const sibling of proofElements) {
        if (hash <= sibling) {
          hash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [hash, sibling]));
        } else {
          hash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [sibling, hash]));
        }
      }
      const root = hash;

      const benchmarks = [
        { name: "hashLeaf", pvmMethod: "hashLeaf", pvmArgs: [LEAF], solMethod: "hashLeafSol", solArgs: [LEAF] },
        { name: "hashPair", pvmMethod: "hashPair", pvmArgs: [LEFT, RIGHT], solMethod: "hashPairSol", solArgs: [LEFT, RIGHT] },
        { name: "verifyProof", pvmMethod: "verifyProof", pvmArgs: [LEAF, proofElements, root], solMethod: "verifyProofSol", solArgs: [LEAF, proofElements, root] },
      ];

      const results = {};
      for (const bench of benchmarks) {
        const [revmGas, pvmGas] = await Promise.all([
          solContract[bench.solMethod].estimateGas(...bench.solArgs),
          pvmContract[bench.pvmMethod].estimateGas(...bench.pvmArgs),
        ]);
        const r = Number(revmGas);
        const p = Number(pvmGas);
        results[bench.name] = {
          revm: r,
          pvm: p,
          savings: `${(((r - p) / r) * 100).toFixed(1)}%`,
        };
      }

      setData(results);
      setSource('live');
    } catch (err) {
      setError(err.message || 'Failed to fetch live data');
      console.error('Live fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute gas values (supports both old and new field names)
  const computeGas = (entry) => ({
    revm: entry.revm ?? entry.solidity ?? 0,
    pvm: entry.pvm ?? entry.rust ?? 0,
  });

  // Computed metrics
  const entries = data ? Object.entries(data) : [];
  const validEntries = entries.filter(([, v]) => {
    const g = computeGas(v);
    return g.revm > 0;
  });

  let avgSavings = '—';
  let bestSavings = '—';
  let bestFunction = '—';
  let totalGasSaved = 0;
  let maxGas = 1;

  if (validEntries.length > 0) {
    const gasData = validEntries.map(([name, v]) => ({ name, ...computeGas(v) }));
    const totalRevm = gasData.reduce((s, d) => s + d.revm, 0);
    const totalPvm = gasData.reduce((s, d) => s + d.pvm, 0);
    totalGasSaved = totalRevm - totalPvm;
    avgSavings = totalRevm > 0 ? `${(((totalRevm - totalPvm) / totalRevm) * 100).toFixed(1)}%` : '—';

    let maxPct = 0;
    for (const d of gasData) {
      const pct = d.revm > 0 ? ((d.revm - d.pvm) / d.revm) * 100 : 0;
      if (pct > maxPct) {
        maxPct = pct;
        bestFunction = d.name;
      }
    }
    bestSavings = `${maxPct.toFixed(1)}%`;
    maxGas = Math.max(...gasData.map(d => d.revm));
  }

  return (
    <div className="app">
      <header className="header">
        <div className="network-badge">
          <span className="live-indicator"></span>
          Polkadot Hub Testnet {source === 'live' ? '• Live' : '• Cached'}
        </div>
        <h1>PVMark</h1>
        <p className="subtitle">PolkaVM (PVM) vs EVM — On-Chain Gas Benchmark</p>
      </header>

      <main className="dashboard">
        {/* Stat Cards */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value accent-pvm">{avgSavings}</div>
            <div className="stat-label">Avg. Delta vs REVM</div>
          </div>
          <div className="stat-card">
            <div className="stat-value accent-success">{bestSavings}</div>
            <div className="stat-label">Best Savings ({bestFunction})</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalGasSaved.toLocaleString()}</div>
            <div className="stat-label">Gas Delta (REVM - PVM)</div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="refresh-row">
          <button
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            onClick={fetchLive}
            disabled={loading}
            id="refresh-benchmark"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Querying testnet...
              </>
            ) : (
              <>🔄 Refresh — Query Live Gas</>
            )}
          </button>
          {error && <p className="error-text">⚠️ {error}</p>}
          {source === 'live' && !loading && <span className="live-badge">✓ Live on-chain data</span>}
        </div>

        {/* Chart */}
        <section className="chart-section">
          <h2>On-Chain Gas Consumption</h2>
          <div className="chart-legend">
            <span className="legend-dot legend-revm"></span> REVM (Solidity)
            <span className="legend-dot legend-pvm"></span> PVM (PolkaVM)
          </div>

          <div className="chart-container">
            {entries.length === 0 && !loading && (
              <p className="empty-text">No data yet. Click "Refresh" to fetch live gas estimates or run <code>npm run benchmark</code>.</p>
            )}
            {entries.map(([name, values]) => {
              const g = computeGas(values);
              const savingPct = g.revm > 0 ? (((g.revm - g.pvm) / g.revm) * 100).toFixed(1) : '0';
              return (
                <div key={name} className="chart-row">
                  <div className="chart-info">
                    <span className="chart-label">{name}</span>
                    <span className={g.revm >= g.pvm ? "saving-text" : "saving-text negative"}>
                      {g.revm >= g.pvm ? '-' : '+'}{Math.abs(savingPct)}%
                    </span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar bar-evm"
                      style={{ width: `${maxGas > 0 ? (g.revm / maxGas) * 100 : 0}%` }}
                    >
                      REVM: {g.revm.toLocaleString()}
                    </div>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar bar-pvm"
                      style={{ width: `${maxGas > 0 ? (g.pvm / maxGas) * 100 : 0}%` }}
                    >
                      PVM: {g.pvm.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contract Addresses */}
        <div className="address-row">
          <div className="address-item">
            <span>PVM Contract (resolc)</span>
            <a
              className="address-val"
              href={`https://blockscout-testnet.polkadot.io/address/${contractAddresses.rust}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {contractAddresses.rust}
            </a>
          </div>
          <div className="address-item">
            <span>REVM Contract (Solidity)</span>
            <a
              className="address-val"
              href={`https://blockscout-testnet.polkadot.io/address/${contractAddresses.solidity}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {contractAddresses.solidity}
            </a>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>
          {data ? `Source: ${source === 'live' ? 'Live testnet query' : 'Cached results'} • ` : ''}
          Polkadot Hub Testnet (Chain 420420417)
        </p>
        <p className="footer-sub">
          Verify: <code>npm run benchmark</code> or check block explorer links above
        </p>
      </footer>
    </div>
  );
}

export default App;
