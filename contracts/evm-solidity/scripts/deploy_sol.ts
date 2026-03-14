import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const rustAddr = "0xf2381ae6b498b06ca52b665344e1f99c3cf08f57";
  console.log("Deploying PVMark Solidity contract with Rust address:", rustAddr);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const PVMark = await ethers.getContractFactory("PVMark");
  const pvmark = await PVMark.deploy(rustAddr);
  await pvmark.waitForDeployment();
  const solAddr = await pvmark.getAddress();
  
  console.log("✅ PVMark Solidity deployed at:", solAddr);

  const outData = JSON.stringify({
    rustAddress: rustAddr,
    solAddress: solAddr
  }, null, 2);
  
  const frontendPath = path.join(__dirname, "../../../apps/dashboard/src/contracts.json");
  fs.writeFileSync(frontendPath, outData);
  console.log("📝 Saved addresses to:", frontendPath);
}

main().catch(console.error);
