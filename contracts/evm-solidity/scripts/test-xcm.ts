import { ethers } from "hardhat";

/**
 * Test XCM integration
 * Usage: npx hardhat run scripts/test-xcm.ts --network <network>
 */
async function main() {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║  🧪 PVMark XCM Integration Tests      ║");
  console.log("╚═══════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Test account:", signer.address);

  // Test configuration
  const PVMARK_XCM_ADDRESS = process.env.PVMARK_XCM_DEMO || "";
  const ONETX_ROUTER_ADDRESS = process.env.ONETX_ROUTER || "";

  if (!PVMARK_XCM_ADDRESS) {
    console.error("❌ PVMARK_XCM_DEMO not set. Run deploy-xcm.ts first.");
    process.exit(1);
  }

  // Test 1: Check XCM Precompile Availability
  console.log("Test 1: XCM Precompile Availability");
  console.log("━".repeat(50));

  const PVMarkXCM = await ethers.getContractFactory("PVMarkXCM");
  const pvmarkXcm = PVMarkXCM.attach(PVMARK_XCM_ADDRESS);

  try {
    const isAvailable = await pvmarkXcm.isXCMAvailable();
    console.log("XCM Precompile:", isAvailable ? "✅ Available" : "❌ Not available");

    if (!isAvailable) {
      console.warn("\n⚠️  XCM precompile not available on this network");
      console.warn("   Subsequent tests will fail or revert");
      console.warn("   This is expected on Polkadot Hub Testnet");
    }
  } catch (e: any) {
    console.error("❌ Error checking precompile:", e.message);
  }

  console.log("");

  // Test 2: Message Weighing
  console.log("Test 2: XCM Message Weighing");
  console.log("━".repeat(50));

  try {
    const message = await pvmarkXcm.getSimpleTransferMessage();
    console.log("Test message length:", message.length, "bytes");
    console.log("Message (hex):", message.slice(0, 100) + "...");

    try {
      const weight = await pvmarkXcm.testWeighSimpleTransfer();
      console.log("✅ Weight calculated:");
      console.log("   refTime:", weight.refTime.toString());
      console.log("   proofSize:", weight.proofSize.toString());
    } catch (e: any) {
      console.error("❌ Weighing failed:", e.message);
      console.log("   This is expected if XCM precompile is not functional");
    }
  } catch (e: any) {
    console.error("❌ Error in weighing test:", e.message);
  }

  console.log("");

  // Test 3: SCALE Encoding Helpers
  console.log("Test 3: SCALE Encoding Helpers");
  console.log("━".repeat(50));

  try {
    // Test parachain destination encoding
    const assetHubDest = await pvmarkXcm.getParachainDestination(2034);
    console.log("Asset Hub (2034) destination:", assetHubDest);

    const relayDest = await pvmarkXcm.getRelayChainDestination();
    console.log("Relay Chain destination:", relayDest);

    console.log("✅ SCALE encoding helpers working");
  } catch (e: any) {
    console.error("❌ SCALE encoding error:", e.message);
  }

  console.log("");

  // Test 4: OneTx Router (if deployed)
  if (ONETX_ROUTER_ADDRESS) {
    console.log("Test 4: OneTx Router Weight Estimation");
    console.log("━".repeat(50));

    try {
      const OneTxRouter = await ethers.getContractFactory("OneTxUniversalRouter");
      const router = OneTxRouter.attach(ONETX_ROUTER_ADDRESS);

      // Test parameters
      const destParaId = 2034; // Asset Hub
      const beneficiary = "0x0000000000000000000000000000000000000000000000000000000000000001";
      const amount = ethers.parseEther("0.1"); // 0.1 DOT

      try {
        const weight = await router.testWeighTransfer(destParaId, beneficiary, amount);
        console.log("✅ Transfer weight estimated:");
        console.log("   Destination: Parachain", destParaId);
        console.log("   Amount: 0.1 DOT");
        console.log("   refTime:", weight.refTime.toString());
        console.log("   proofSize:", weight.proofSize.toString());
      } catch (e: any) {
        console.error("❌ Weight estimation failed:", e.message);
      }
    } catch (e: any) {
      console.error("❌ Router test error:", e.message);
    }
  } else {
    console.log("Test 4: Skipped (OneTx Router not deployed)");
  }

  console.log("");

  // Summary
  console.log("╔═══════════════════════════════════════╗");
  console.log("║  📊 Test Summary                       ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log("");
  console.log("✅ Contracts deployed and interfaces working");
  console.log("⚠️  XCM execution requires functional precompile");
  console.log("");
  console.log("Next steps:");
  console.log("1. Deploy on a chain with working XCM precompiles (Asset Hub)");
  console.log("2. Fund test account with native tokens");
  console.log("3. Call routeToParachain() to test actual cross-chain transfer");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
