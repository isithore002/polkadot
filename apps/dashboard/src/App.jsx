import React from 'react';
import contracts from './contracts.json';
import benchmark from './benchmarkResults.json';

function App() {
  const data = benchmark.results;
  const entries = Object.entries(data);
  const maxGas = Math.max(...entries.map(([, v]) => v.solidity));

  return (
    <div className="app">
      <header className="header">
        <div className="network-badge">
          <span className="live-indicator"></span>
          Polkadot Hub Testnet Live
        </div>
        <h1>PVMark</h1>
        <p className="subtitle">High Performance Cryptography — PolkaVM (Rust) vs EVM (Solidity)</p>
      </header>

      <main className="dashboard">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{entries.length}</div>
            <div className="stat-label">Functions Tested</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">~68%</div>
            <div className="stat-label">Avg. Gas Savings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">6x</div>
            <div className="stat-label">PVM Peak Efficiency</div>
          </div>
        </div>

        <section className="chart-section">
          <h2>On-Chain Gas Consumption (Unit: Weight/Gas)</h2>
          <div className="chart-container">
            {entries.map(([name, { solidity, rust }]) => {
              const saving = ((solidity - rust) / solidity * 100).toFixed(1);
              return (
                <div key={name} className="chart-row">
                  <div className="chart-info">
                    <span className="chart-label">{name}</span>
                    <span className="saving-text">-{saving}% Savings</span>
                  </div>
                  <div className="bar-container">
                    <div className="bar bar-evm" style={{ width: `${(solidity / maxGas) * 100}%` }}>
                      EVM: {solidity.toLocaleString()}
                    </div>
                  </div>
                  <div className="bar-container">
                    <div className="bar bar-pvm" style={{ width: `${(rust / maxGas) * 100}%` }}>
                      PVM: {rust.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="address-row">
          <div className="address-item">
            <span>Solidity Wrapper</span>
            <span className="address-val">{contracts.solAddress}</span>
          </div>
          <div className="address-item">
            <span>PolkaVM Contract</span>
            <span className="address-val">{contracts.rustAddress}</span>
          </div>
        </div>
      </main>

      <footer className="footer" style={{ marginTop: '4rem' }}>
        <p>Verified on {benchmark.network} • {new Date(benchmark.timestamp).toLocaleDateString()}</p>
      </footer>
    </div>
  );
}

export default App;
