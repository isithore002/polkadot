import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    const rpc = process.env.WESTEND_RPC || "https://eth-rpc-testnet.polkadot.io";
    const pk = process.env.PRIVATE_KEY;

    if (!pk) throw new Error("PRIVATE_KEY not found");

    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);

    console.log("Deploying Rust PolkaVM contract via ethers...");
    
    const binPath = path.join(__dirname, "../contracts/pvm-rust/contract.polkavm");
    const bytecode = "0x" + fs.readFileSync(binPath).toString("hex");

    console.log("Bytecode length:", bytecode.length);

    // Get current nonce
    const nonce = await wallet.getNonce();
    const feeData = await provider.getFeeData();

    console.log("Nonce:", nonce);

    const tx = {
        data: bytecode,
        gasLimit: 5000000,
        gasPrice: feeData.gasPrice,
        nonce: nonce,
        chainId: 420420421
    };

    try {
        const sentTx = await wallet.sendTransaction(tx);
        console.log("Transaction sent:", sentTx.hash);
        console.log("Waiting for confirmation...");
        const receipt = await sentTx.wait();
        console.log("✅ Rust PolkaVM deployed at:", receipt?.contractAddress);
        
        // Update contracts.json
        const contractsPath = path.join(__dirname, "../apps/dashboard/src/contracts.json");
        let contracts = { rust: "", solidity: "" };
        if (fs.existsSync(contractsPath)) {
            contracts = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
        }
        contracts.rust = receipt?.contractAddress || "";
        fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
        
    } catch (error: any) {
        console.error("❌ Deployment failed");
        console.error(error);
        if (error.data) {
            console.error("Revert data:", error.data);
        }
    }
}

main().catch(console.error);
