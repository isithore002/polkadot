import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("PVMark Deployment Suite");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Deploy Rust contract
  console.log("Checking for Rust PolkaVM binary...");
  const rustBinPath = path.join(__dirname, "../../pvm-rust/contract.polkavm");
  let rustAddr = "0x0000000000000000000000000000000000000000";

  if (fs.existsSync(rustBinPath)) {
    console.log("Deploying Rust PolkaVM contract...");
    const bytecode = "0x" + fs.readFileSync(rustBinPath).toString("hex");
    
    try {
      const tx = await deployer.sendTransaction({
        data: bytecode,
        gasLimit: 5000000,
      });
      console.log("Rust deploy tx sent:", tx.hash);
      const receipt = await tx.wait();
      if (receipt?.status === 1) {
        rustAddr = receipt.contractAddress || "";
        console.log("✅ Rust PolkaVM deployed at:", rustAddr);
      } else {
        console.warn("⚠️ Rust contract deployment REVERTED. Results will be inaccurate.");
      }
    } catch (e: any) {
      console.error("❌ Failed to send Rust deployment tx:", e.message);
    }
  } else {
    console.warn("⚠️ Rust binary missing. Skipping Rust contract deployment.");
  }

  // 2. Deploy Solidity contract
  console.log("Deploying PVMark Solidity contract...");
  const PVMark = await ethers.getContractFactory("PVMark");
  try {
    const pvmark = await PVMark.deploy(rustAddr);
    await pvmark.waitForDeployment();
    const solAddr = await pvmark.getAddress();
    console.log("✅ PVMark Solidity deployed at:", solAddr);

    // 3. Save addresses
    const contractsPath = path.join(__dirname, "../../../apps/dashboard/src/contracts.json");
    const contracts = {
      rust: rustAddr,
      solidity: solAddr
    };
    
    // Ensure directory exists
    const dir = path.dirname(contractsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
    console.log("✅ Contract addresses saved to dashboard/src/contracts.json");
    
  } catch (e: any) {
    console.error("❌ Failed to deploy Solidity contract:", e.message);
    process.exit(1);
  }
}

main().catch(console.error);
