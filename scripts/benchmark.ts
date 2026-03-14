import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  console.log("PVMark Live Gas Benchmark");

  const contractsPath = path.join(__dirname, "../apps/dashboard/src/contracts.json");
  if (!fs.existsSync(contractsPath)) {
    console.error("contracts.json missing. Run deploy first.");
    process.exit(1);
  }
  const { rustAddress, solAddress } = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
  
  const rpc = process.env.WESTEND_RPC || "https://eth-rpc-testnet.polkadot.io";
  const provider = new ethers.JsonRpcProvider(rpc);
  
  const abi = [
    "function hashLeafRust(bytes32 leaf) external view returns (bytes32)",
    "function hashPairRust(bytes32 left, bytes32 right) external view returns (bytes32)",
    "function verifyProofRust(bytes32 root, bytes32 leaf, bytes32[4] calldata proof) external returns (bool)",
    "function hashLeafSol(bytes32 leaf) external pure returns (bytes32)",
    "function hashPairSol(bytes32 left, bytes32 right) external pure returns (bytes32)",
    "function verifyProofSol(bytes32 root, bytes32 leaf, bytes32[4] calldata proof) external pure returns (bool)"
  ];
  
  const solContract = new ethers.Contract(solAddress, abi, provider);
  
  const leaf = ethers.keccak256(ethers.toUtf8Bytes("leaf1"));
  const right = ethers.keccak256(ethers.toUtf8Bytes("leaf2"));
  const root = ethers.keccak256(ethers.concat([leaf, right])); // simplified for mock check
  const proof = [right, right, right, right];

  console.log("Estimating gas on:", solAddress);

  const results: any = {};

  // hashLeaf
  const gLeafRust = await solContract.hashLeafRust.estimateGas(leaf);
  const gLeafSol = await solContract.hashLeafSol.estimateGas(leaf);
  results.hashLeaf = { solidity: Number(gLeafSol), rust: Number(gLeafRust) };

  // hashPair
  const gPairRust = await solContract.hashPairRust.estimateGas(leaf, right);
  const gPairSol = await solContract.hashPairSol.estimateGas(leaf, right);
  results.hashPair = { solidity: Number(gPairSol), rust: Number(gPairRust) };

  // verifyProof
  const gProofRust = await solContract.verifyProofRust.estimateGas(root, leaf, proof);
  const gProofSol = await solContract.verifyProofSol.estimateGas(root, leaf, proof);
  results.verifyProof = { solidity: Number(gProofSol), rust: Number(gProofRust) };

  const report = {
    timestamp: new Date().toISOString(),
    network: "polkadotHubTestnet",
    results: results
  };

  const resultsPath = path.join(__dirname, "../apps/dashboard/src/benchmarkResults.json");
  fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2));
  console.log("✅ Benchmark complete. Results saved to dashboard.");
  
  console.table(Object.entries(results).map(([k, v]: any) => ({
    "Function": k,
    "Solidity Gas": v.solidity,
    "Rust Gas": v.rust,
    "Savings": v.solidity - v.rust,
    "% Cheaper": ((v.solidity - v.rust) / v.solidity * 100).toFixed(1) + "%"
  })));
}

main().catch(console.error);
