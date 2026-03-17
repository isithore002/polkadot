/**
 * PVMark Benchmark Script
 * 
 * Runs estimateGas on both the PVM (resolc) contract and the REVM (Solidity)
 * contract deployed on the Polkadot Hub Testnet. Outputs a formatted table
 * and writes benchmarkResults.json for the dashboard.
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const RPC_URL = process.env.WESTEND_RPC || "https://eth-rpc-testnet.polkadot.io";

// ABI for benchmark functions — same on both contracts
const BENCHMARK_ABI = [
  "function hashLeaf(bytes32 leaf) view returns (bytes32)",
  "function hashPair(bytes32 left, bytes32 right) view returns (bytes32)",
  "function verifyProof(bytes32 leaf, bytes32[] proof, bytes32 root) view returns (bool)",
  "function hashChain(bytes32 seed, uint256 rounds) view returns (bytes32)",
  "function pairingLoop(uint256 rounds) view returns (uint256)",
  "function modExp(uint256 base, uint256 exp, uint256 mod) view returns (uint256)",
  "function matrixMul(uint256 n) view returns (uint256)",
];

// The Solidity wrapper has *Sol and *Rust suffixed variants
const SOLIDITY_ABI = [
  "function hashLeafSol(bytes32 leaf) view returns (bytes32)",
  "function hashPairSol(bytes32 left, bytes32 right) view returns (bytes32)",
  "function verifyProofSol(bytes32 leaf, bytes32[] proof, bytes32 root) view returns (bool)",
  "function hashLeafRust(bytes32 leaf) view returns (bytes32)",
  "function hashPairRust(bytes32 left, bytes32 right) view returns (bytes32)",
  "function verifyProofRust(bytes32 leaf, bytes32[] proof, bytes32 root) returns (bool)",
];

// Test data
const LEAF = ethers.keccak256(ethers.toUtf8Bytes("pvmark-benchmark-leaf"));
const LEFT = ethers.keccak256(ethers.toUtf8Bytes("left-node"));
const RIGHT = ethers.keccak256(ethers.toUtf8Bytes("right-node"));

// Build a small Merkle proof for verifyProof
function buildTestProof() {
  const proofElements = [
    ethers.keccak256(ethers.toUtf8Bytes("sibling-1")),
    ethers.keccak256(ethers.toUtf8Bytes("sibling-2")),
    ethers.keccak256(ethers.toUtf8Bytes("sibling-3")),
    ethers.keccak256(ethers.toUtf8Bytes("sibling-4")),
  ];
  // Compute the root from the leaf + proof (same algorithm as the contract)
  let hash = LEAF;
  for (const sibling of proofElements) {
    if (hash <= sibling) {
      hash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [hash, sibling]));
    } else {
      hash = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [sibling, hash]));
    }
  }
  return { proof: proofElements, root: hash };
}

interface BenchmarkEntry {
  revm: number;
  pvm: number;
  savings: string;
}

async function estimateWithTimeout(
  contract: ethers.Contract,
  method: string,
  args: any[],
  label: string,
  timeoutMs = 60000,
  retries = 3
): Promise<bigint> {
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.race([
        contract[method].estimateGas(...args),
        new Promise<bigint>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout estimating ${label}`)), timeoutMs)
        ),
      ]);
    } catch (err: any) {
      const isTimeout =
        err.code === "TIMEOUT" ||
        err.message?.includes("Timeout") ||
        err.message?.includes("timeout");
      if (isTimeout && i < retries - 1) {
        console.log(`  Timeout on attempt ${i + 1}, retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All retries failed");
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         PVMark Benchmark Suite               ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    staticNetwork: true,
    polling: true,
    pollingInterval: 4000,
  });
  const network = await provider.getNetwork();
  console.log(`Network: chainId=${network.chainId}, RPC=${RPC_URL}\n`);

  // Load contract addresses
  const contractsPath = path.resolve(__dirname, "../apps/dashboard/src/contracts.json");
  if (!fs.existsSync(contractsPath)) {
    console.error("contracts.json not found. Run deploy first.");
    process.exit(1);
  }
  const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
  
  // Use the direct PVM and REVM addresses (same source, different compilers)
  const pvmAddr = contracts.pvm || contracts.rust;
  const revmAddr = contracts.revm || contracts.solidity;

  console.log("PVM Contract (resolc):  ", pvmAddr);
  console.log("REVM Contract (solc):   ", revmAddr);
  console.log("Same source: PVMarkPVM.sol — same functions, two VMs\n");

  // Both contracts have the SAME ABI (from PVMarkPVM.sol)
  const pvmContract = new ethers.Contract(pvmAddr, BENCHMARK_ABI, provider);
  const revmContract = new ethers.Contract(revmAddr, BENCHMARK_ABI, provider);

  const { proof, root } = buildTestProof();

  // Define benchmark calls
  const benchmarks: {
    name: string;
    args: any[];
  }[] = [
    {
      name: "hashLeaf",
      args: [LEAF],
    },
    {
      name: "hashPair",
      args: [LEFT, RIGHT],
    },
    {
      name: "verifyProof",
      args: [LEAF, proof, root],
    },
    {
      name: "hashChain",
      args: [LEAF, 1000],
    },
    {
      name: "pairingLoop",
      args: [500],
    },
    {
      name: "modExp",
      args: [7n, 500n, 1000000007n],
    },
    {
      name: "matrixMul",
      args: [16n],
    },
  ];

  const results: Record<string, BenchmarkEntry> = {};
  const SEPARATOR = "─".repeat(64);

  console.log("┌────────────────┬────────────┬────────────┬──────────┬────────────┐");
  console.log("│ Function       │  REVM Gas  │  PVM Gas   │ Savings  │ % Cheaper  │");
  console.log("├────────────────┼────────────┼────────────┼──────────┼────────────┤");

  for (const bench of benchmarks) {
    try {
      // Estimate gas for REVM (Solidity-on-EVM) path
      const revmGas = await estimateWithTimeout(
        revmContract,
        bench.name,
        bench.args,
        `REVM:${bench.name}`
      );

      // Estimate gas for PVM (resolc-compiled) path
      const pvmGas = await estimateWithTimeout(
        pvmContract,
        bench.name,
        bench.args,
        `PVM:${bench.name}`
      );

      const rGas = Number(revmGas);
      const pGas = Number(pvmGas);
      const savingsAbs = rGas - pGas;
      const savingsPct = ((savingsAbs / rGas) * 100).toFixed(1);

      results[bench.name] = {
        revm: rGas,
        pvm: pGas,
        savings: `${savingsPct}%`,
      };

      const row = [
        `│ ${bench.name.padEnd(14)}`,
        `│ ${String(rGas).padStart(10)}`,
        `│ ${String(pGas).padStart(10)}`,
        `│ ${String(savingsAbs).padStart(8)}`,
        `│ ${savingsPct.padStart(7)}%   │`,
      ].join(" ");
      console.log(row);
    } catch (err: any) {
      console.log(`│ ${bench.name.padEnd(14)} │   ERROR    │   ERROR    │   N/A    │    N/A     │`);
      console.error(`  └─ ${err.message}`);

      // Use fallback values if live estimation fails
      results[bench.name] = { revm: 0, pvm: 0, savings: "N/A" };
    }
  }

  console.log("└────────────────┴────────────┴────────────┴──────────┴────────────┘");

  // Write results
  const report = {
    timestamp: new Date().toISOString(),
    network: `polkadotHub-testnet (chain ${network.chainId})`,
    pvmContract: pvmAddr,
    solContract: revmAddr,
    results,
  };

  // Save to data/
  const dataDir = path.resolve(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dataPath = path.join(dataDir, "benchmark-results.json");
  fs.writeFileSync(dataPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Results saved to ${dataPath}`);

  // Copy into dashboard for cached display
  const dashboardPath = path.resolve(__dirname, "../apps/dashboard/src/benchmarkResults.json");
  fs.writeFileSync(dashboardPath, JSON.stringify(report, null, 2));
  console.log(`✅ Results copied to dashboard (benchmarkResults.json)`);

  // Summary
  const validResults = Object.values(results).filter((r) => r.revm > 0);
  if (validResults.length > 0) {
    const totalRevm = validResults.reduce((s, r) => s + r.revm, 0);
    const totalPvm = validResults.reduce((s, r) => s + r.pvm, 0);
    const avgSaving = (((totalRevm - totalPvm) / totalRevm) * 100).toFixed(1);
    const bestSaving = Math.max(
      ...validResults.map((r) => ((r.revm - r.pvm) / r.revm) * 100)
    ).toFixed(1);

    console.log(`\n📊 Summary:`);
    console.log(`   Avg gas savings: ${avgSaving}%`);
    console.log(`   Best savings:    ${bestSaving}%`);
    console.log(`   Total gas saved: ${totalRevm - totalPvm}`);
  }
}

main().catch(console.error);
