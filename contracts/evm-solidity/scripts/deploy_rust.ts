import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("Deploying Rust PolkaVM contract via Hardhat/ethers...");
    
    const binPath = path.join(__dirname, "../../pvm-rust/contract.polkavm");
    const bytecode = "0x" + fs.readFileSync(binPath).toString("hex");

    const [signer] = await ethers.getSigners();
    console.log("Deployer:", signer.address);

    const tx = await signer.sendTransaction({
        data: bytecode,
        gasLimit: 5000000,
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Rust PolkaVM deployed at:", receipt?.contractAddress);
    
    // Update contracts.json
    const contractsPath = path.join(__dirname, "../apps/dashboard/src/contracts.json");
    let contracts = { rust: "", solidity: "" };
    if (fs.existsSync(contractsPath)) {
        contracts = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
    }
    contracts.rust = receipt?.contractAddress || "";
    fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
}

main().catch(console.error);
