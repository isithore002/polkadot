/**
 * Standalone deploy script using ethers.JsonRpcProvider directly.
 * Bypasses hardhat's undici-based HTTP layer, which has TLS issues in WSL2.
 * The benchmark already confirms JsonRpcProvider works correctly on this network.
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const RPC_URL = process.env.WESTEND_RPC || "https://eth-rpc-testnet.polkadot.io";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const ARTIFACTS_DIR = path.resolve(__dirname, "../contracts/evm-solidity/artifacts/contracts");
const PVM_BIN      = path.resolve(__dirname, "../contracts/evm-solidity/bin/PVMarkPVM.polkavm");
const CONTRACTS_OUT = path.resolve(__dirname, "../apps/dashboard/src/contracts.json");
const ENV_PATH     = path.resolve(__dirname, "../.env");

async function waitReceipt(
  provider: ethers.JsonRpcProvider,
  hash: string,
  label: string
): Promise<ethers.TransactionReceipt> {
  console.log(`  Waiting for ${label} (${hash.slice(0, 10)}…)`);
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 6000));
    const receipt = await provider.getTransactionReceipt(hash).catch(() => null);
    if (receipt) {
      if (receipt.status !== 1) throw new Error(`${label} reverted`);
      return receipt;
    }
    process.stdout.write(".");
  }
  throw new Error(`${label} not confirmed after 120s`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     PVMark Standalone Deploy (ethers.js)     ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    staticNetwork: true,
    polling: true,
    pollingInterval: 4000,
  });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  console.log(`Network: chainId=${network.chainId}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error("Deployer has no balance — fund the account first.");
  }

  // ── Step 1: Deploy PVM (resolc binary) ────────────────────────────────────
  console.log("── Step 1: Deploy PVM contract (resolc binary) ──");
  let pvmAddr = "0x0000000000000000000000000000000000000000";
  if (fs.existsSync(PVM_BIN)) {
    const bytecode = "0x" + fs.readFileSync(PVM_BIN).toString("hex");
    console.log(`  Binary: ${fs.statSync(PVM_BIN).size} bytes`);
    const tx = await wallet.sendTransaction({ data: bytecode, gasLimit: 10_000_000 });
    console.log(`  Tx: ${tx.hash}`);
    const receipt = await waitReceipt(provider, tx.hash, "PVM deploy");
    pvmAddr = receipt.contractAddress!;
    console.log(`\n✅ PVM deployed at: ${pvmAddr}`);
  } else {
    console.warn("⚠️  PVM binary not found — skipping.");
  }

  // ── Step 2: Deploy REVM (solc artifact) ───────────────────────────────────
  console.log("\n── Step 2: Deploy REVM contract (solc artifact) ──");
  const pvmArtifact = JSON.parse(
    fs.readFileSync(path.join(ARTIFACTS_DIR, "PVMarkPVM.sol/PVMarkPVM.json"), "utf-8")
  );
  const revmFactory = new ethers.ContractFactory(pvmArtifact.abi, pvmArtifact.bytecode, wallet);
  const revmTx = await revmFactory.getDeployTransaction();
  const revmSent = await wallet.sendTransaction({ ...revmTx, gasLimit: 5_000_000 });
  console.log(`  Tx: ${revmSent.hash}`);
  const revmReceipt = await waitReceipt(provider, revmSent.hash, "REVM deploy");
  const revmAddr = revmReceipt.contractAddress!;
  console.log(`\n✅ REVM deployed at: ${revmAddr}`);

  // ── Step 3: Deploy PVMark wrapper ─────────────────────────────────────────
  console.log("\n── Step 3: Deploy PVMark wrapper ──");
  const wrapperArtifact = JSON.parse(
    fs.readFileSync(path.join(ARTIFACTS_DIR, "PVMark.sol/PVMark.json"), "utf-8")
  );
  const wrapperFactory = new ethers.ContractFactory(
    wrapperArtifact.abi, wrapperArtifact.bytecode, wallet
  );
  const wrapperTx = await wrapperFactory.getDeployTransaction(pvmAddr);
  const wrapperSent = await wallet.sendTransaction({ ...wrapperTx, gasLimit: 3_000_000 });
  console.log(`  Tx: ${wrapperSent.hash}`);
  const wrapperReceipt = await waitReceipt(provider, wrapperSent.hash, "Wrapper deploy");
  const wrapperAddr = wrapperReceipt.contractAddress!;
  console.log(`\n✅ Wrapper deployed at: ${wrapperAddr}`);

  // ── Step 4: Save addresses ─────────────────────────────────────────────────
  const contracts = { pvm: pvmAddr, revm: revmAddr, wrapper: wrapperAddr,
                      rust: pvmAddr, solidity: wrapperAddr };
  fs.mkdirSync(path.dirname(CONTRACTS_OUT), { recursive: true });
  fs.writeFileSync(CONTRACTS_OUT, JSON.stringify(contracts, null, 2));
  console.log("\n✅ contracts.json updated:");
  console.log(JSON.stringify(contracts, null, 2));

  let env = fs.readFileSync(ENV_PATH, "utf-8");
  env = env.replace(/PVMARK_SOLIDITY_ADDRESS=.*/, `PVMARK_SOLIDITY_ADDRESS=${wrapperAddr}`);
  env = env.replace(/PVMARK_RUST_ADDRESS=.*/,     `PVMARK_RUST_ADDRESS=${pvmAddr}`);
  fs.writeFileSync(ENV_PATH, env);
  console.log("✅ .env updated");
}

main().catch(e => { console.error(e.message); process.exit(1); });
