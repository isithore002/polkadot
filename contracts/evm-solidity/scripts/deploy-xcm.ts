import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy XCM-enabled contracts
 * Usage: npx hardhat run scripts/deploy-xcm.ts --network <network>
 */
async function main() {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║  🚀 PVMark XCM Contract Deployment    ║");
  console.log("╚═══════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Check if XCM precompile is available
  const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
  const code = await ethers.provider.getCode(XCM_PRECOMPILE);

  if (code === "0x" || code === "0x60006000fd") {
    console.warn("⚠️  WARNING: XCM precompile not available or is a stub");
    console.warn("   Contracts will deploy but XCM calls will revert");
    console.warn("   Consider using Asset Hub or another chain with XCM support\n");
  } else {
    console.log("✅ XCM precompile detected at", XCM_PRECOMPILE, "\n");
  }

  const deployedContracts: any = {};

  // Deploy PVMarkXCM (demo/testing contract)
  console.log("📦 Deploying PVMarkXCM...");
  try {
    const PVMarkXCM = await ethers.getContractFactory("PVMarkXCM");
    const pvmarkXcm = await PVMarkXCM.deploy();
    await pvmarkXcm.waitForDeployment();

    const pvmarkXcmAddr = await pvmarkXcm.getAddress();
    deployedContracts.pvmarkXcm = pvmarkXcmAddr;
    console.log("✅ PVMarkXCM deployed at:", pvmarkXcmAddr);

    // Test XCM availability
    const isAvailable = await pvmarkXcm.isXCMAvailable();
    console.log("   XCM precompile check:", isAvailable ? "✅ Available" : "❌ Not available");
  } catch (e: any) {
    console.error("❌ PVMarkXCM deployment failed:", e.message);
  }

  console.log("");

  // Deploy OneTxUniversalRouter
  console.log("📦 Deploying OneTxUniversalRouter...");
  try {
    const OneTxRouter = await ethers.getContractFactory("OneTxUniversalRouter");
    const router = await OneTxRouter.deploy();
    await router.waitForDeployment();

    const routerAddr = await router.getAddress();
    deployedContracts.oneTxRouter = routerAddr;
    console.log("✅ OneTxUniversalRouter deployed at:", routerAddr);
  } catch (e: any) {
    console.error("❌ OneTxUniversalRouter deployment failed:", e.message);
  }

  console.log("");

  // Deploy OneTxPVMRouter (with placeholder Rust addresses)
  console.log("📦 Deploying OneTxPVMRouter...");
  try {
    // Use zero addresses as placeholders for Rust contracts
    const RUST_XCM_BUILDER = ethers.ZeroAddress;
    const RUST_RISK_ANALYZER = ethers.ZeroAddress;

    const OneTxPVMRouter = await ethers.getContractFactory("OneTxPVMRouter");
    const pvmRouter = await OneTxPVMRouter.deploy(RUST_XCM_BUILDER, RUST_RISK_ANALYZER);
    await pvmRouter.waitForDeployment();

    const pvmRouterAddr = await pvmRouter.getAddress();
    deployedContracts.oneTxPVMRouter = pvmRouterAddr;
    console.log("✅ OneTxPVMRouter deployed at:", pvmRouterAddr);
    console.log("   (Rust contracts not configured - use smartRoute with caution)");
  } catch (e: any) {
    console.error("❌ OneTxPVMRouter deployment failed:", e.message);
  }

  // Save deployment info
  console.log("\n📝 Saving deployment info...");

  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
    xcmPrecompile: XCM_PRECOMPILE,
    xcmAvailable: code !== "0x" && code !== "0x60006000fd",
  };

  // Save to contracts.json in dashboard
  const contractsPath = path.join(__dirname, "../../contracts.json");
  const contracts = {
    ...deployedContracts,
    pvm: process.env.PVMARK_RUST_ADDRESS || ethers.ZeroAddress,
    revm: process.env.PVMARK_SOLIDITY_ADDRESS || ethers.ZeroAddress,
    deployedAt: deploymentInfo.timestamp,
  };

  fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2));
  console.log("✅ Contracts saved to contracts.json");

  // Save detailed deployment info
  const deploymentPath = path.join(__dirname, "../deployments", `xcm-${Date.now()}.json`);
  const deploymentDir = path.dirname(deploymentPath);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to", deploymentPath);

  // Update .env if needed
  console.log("\n📝 Environment variables:");
  console.log(`export PVMARK_XCM_DEMO=${deployedContracts.pvmarkXcm || "NOT_DEPLOYED"}`);
  console.log(`export ONETX_ROUTER=${deployedContracts.oneTxRouter || "NOT_DEPLOYED"}`);
  console.log(`export ONETX_PVM_ROUTER=${deployedContracts.oneTxPVMRouter || "NOT_DEPLOYED"}`);

  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
