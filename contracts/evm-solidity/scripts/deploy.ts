import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Helper: wait for tx with a timeout
async function waitWithTimeout(tx: any, timeoutMs: number): Promise<any> {
  return Promise.race([
    tx.wait(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tx confirmation timed out after ${timeoutMs / 1000}s. Tx hash: ${tx.hash}`)), timeoutMs)
    ),
  ]);
}

async function main() {
  console.log("PVMark Deployment Suite\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // ─── Step 1: Deploy PVM contract (resolc binary) ───
  console.log("\n--- Step 1: Deploy PolkaVM contract (resolc) ---");
  const rustBinPath = path.join(__dirname, "../../pvm-rust/contract.polkavm");
  const resolcBinPath = path.join(__dirname, "../bin/PVMarkPVM.polkavm");

  // Prefer resolc binary when it exists — it contains the full 7-function benchmark ABI.
  // Fall back to the hand-written Rust binary only when no resolc binary is present.
  let pvmBinPath = "";
  if (fs.existsSync(resolcBinPath)) {
    pvmBinPath = resolcBinPath;
    console.log("Using resolc-compiled binary (full benchmark ABI).");
  } else if (fs.existsSync(rustBinPath)) {
    pvmBinPath = rustBinPath;
    console.log("Using raw Rust binary (fallback).");
  }

  let pvmAddr = "0x0000000000000000000000000000000000000000";

  if (pvmBinPath) {
    const binSize = fs.statSync(pvmBinPath).size;
    console.log(`Binary size: ${binSize} bytes`);
    const bytecode = "0x" + fs.readFileSync(pvmBinPath).toString("hex");
    
    try {
      console.log("Sending PVM deployment tx...");
      const tx = await deployer.sendTransaction({
        data: bytecode,
        gasLimit: 10_000_000,
      });
      console.log("PVM deploy tx sent:", tx.hash);
      console.log("Waiting for confirmation (up to 90s)...");
      
      const receipt = await waitWithTimeout(tx, 90_000);
      if (receipt?.status === 1) {
        pvmAddr = receipt.contractAddress || "";
        console.log("✅ PVM contract deployed at:", pvmAddr);
      } else {
        console.warn("⚠️ PVM contract deployment REVERTED.");
      }
    } catch (e: any) {
      console.error("❌ PVM deployment failed:", e.message);
    }
  } else {
    console.warn("⚠️ No PolkaVM binary found. Skipping.");
  }

  // ─── Step 2: Deploy PVMarkPVM via Hardhat/solc (same source → EVM) ───
  console.log("\n--- Step 2: Deploy REVM contract (solc) ---");
  let revmAddr = "0x0000000000000000000000000000000000000000";
  try {
    const PVMarkPVM = await ethers.getContractFactory("PVMarkPVM");
    console.log("Sending REVM deployment tx...");
    const revm = await PVMarkPVM.deploy();
    console.log("Waiting for confirmation (up to 90s)...");
    await revm.waitForDeployment();
    revmAddr = await revm.getAddress();
    console.log("✅ REVM contract deployed at:", revmAddr);
  } catch (e: any) {
    console.error("❌ REVM deployment failed:", e.message);
  }

  // ─── Step 3: Deploy PVMark wrapper (references PVM contract) ───
  console.log("\n--- Step 3: Deploy PVMark Solidity wrapper ---");
  let wrapperAddr = "0x0000000000000000000000000000000000000000";
  try {
    const PVMark = await ethers.getContractFactory("PVMark");
    console.log("Sending wrapper deployment tx...");
    const pvmark = await PVMark.deploy(pvmAddr);
    console.log("Waiting for confirmation (up to 90s)...");
    await pvmark.waitForDeployment();
    wrapperAddr = await pvmark.getAddress();
    console.log("✅ PVMark wrapper deployed at:", wrapperAddr);
  } catch (e: any) {
    console.error("❌ Wrapper deployment failed:", e.message);
  }

  // ─── Step 4: Save addresses ───
  const contractsPath = path.join(__dirname, "../../../apps/dashboard/src/contracts.json");
  const contracts = {
    pvm: pvmAddr,         // PVMarkPVM compiled by resolc → PolkaVM
    revm: revmAddr,       // PVMarkPVM compiled by solc   → EVM
    wrapper: wrapperAddr, // PVMark wrapper that delegates to PVM
    // Legacy field names for backward compat
    rust: pvmAddr,
    solidity: wrapperAddr,
  };
  
  const dir = path.dirname(contractsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
  console.log("\n✅ Addresses saved to contracts.json");
  console.log(JSON.stringify(contracts, null, 2));

  // Update .env
  const envPath = path.join(__dirname, "../../../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(/PVMARK_SOLIDITY_ADDRESS=.*/, `PVMARK_SOLIDITY_ADDRESS=${wrapperAddr}`);
  envContent = envContent.replace(/PVMARK_RUST_ADDRESS=.*/, `PVMARK_RUST_ADDRESS=${pvmAddr}`);
  fs.writeFileSync(envPath, envContent);
  console.log("✅ .env updated");
}

main().catch(console.error);
