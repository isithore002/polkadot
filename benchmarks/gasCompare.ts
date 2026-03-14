import * as fs from "fs";
import * as path from "path";

async function main() {
  const dataPath = path.resolve(__dirname, "../data/benchmark-results.json");
  if (!fs.existsSync(dataPath)) {
    console.error("No benchmark results found. Run benchmark first.");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  console.log("PVMark - EVM vs PVM Gas Comparison\n");
  console.log("Network:", report.network);
  console.log("Timestamp:", report.timestamp, "\n");
  console.log("Operation        | EVM (gas)  | PVM (ref)  | Saving");
  console.log("-".repeat(60));

  for (const [name, result] of Object.entries(report.results) as any) {
    const saving = ((result.solidity - result.rust) / result.solidity * 100).toFixed(1);
    const row = name.padEnd(16) + " | " + String(result.solidity).padStart(10) + " | " + String(result.rust).padStart(10) + " | " + saving + "%";
    console.log(row);
  }
}

main().catch(console.error);
