import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const binPath = path.join(__dirname, "../bin/Simple.polkavm");
  console.log(`Deploying Simple.polkavm from ${binPath}...`);
  const bytecode = "0x" + fs.readFileSync(binPath).toString("hex");
  
  try {
    const tx = await deployer.sendTransaction({
      data: bytecode,
      gasLimit: 5000000,
    });
    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt?.status);
    console.log("Address:", receipt?.contractAddress);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}

main().catch(console.error);
