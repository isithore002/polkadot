import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying PVMark wrapper contract\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get PVM contract address from env
  const pvmAddress = process.env.PVMARK_RUST_ADDRESS || "0x0000000000000000000000000000000000000000";

  if (pvmAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ PVMARK_RUST_ADDRESS not set in .env");
    process.exit(1);
  }

  console.log("PVM contract address:", pvmAddress);
  console.log("");

  // Deploy PVMark wrapper
  console.log("Deploying PVMark wrapper...");
  const PVMark = await ethers.getContractFactory("PVMark");
  const pvmark = await PVMark.deploy(pvmAddress);
  await pvmark.waitForDeployment();

  const wrapperAddr = await pvmark.getAddress();
  console.log("✅ PVMark wrapper deployed at:", wrapperAddr);

  // Update .env
  const envPath = path.join(__dirname, "../../../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(/PVMARK_SOLIDITY_ADDRESS=.*/, `PVMARK_SOLIDITY_ADDRESS=${wrapperAddr}`);
  fs.writeFileSync(envPath, envContent);
  console.log("✅ .env updated");
}

main().catch(console.error);
