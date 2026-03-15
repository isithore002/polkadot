const { ethers } = require('ethers');

const RPC = 'https://services.polkadothub-rpc.com/testnet/';
const PVM_ADDR = '0xE4dE3ab9253473a7AeD4031c3B4928BE5c7Ad129';
const SOL_ADDR = '0x6310Bf7efa50B7DD202608C6eF1350E9b6aA81cB';
const LEAF = '0x0000000000000000000000000000000000000000000000000000000000000001';

const pvmAbi = [
  'function hashLeaf(bytes32) view returns (bytes32)',
  'function hashPair(bytes32,bytes32) view returns (bytes32)',
  'function verifyProof(bytes32,bytes32[],bytes32) view returns (bool)',
];
const solAbi = [
  'function hashLeafSol(bytes32) view returns (bytes32)',
  'function hashPairSol(bytes32,bytes32) view returns (bytes32)',
  'function verifyProofSol(bytes32,bytes32[],bytes32) view returns (bool)',
];

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  console.log('=== Step 1: Contract Verification ===\n');

  // --- PVM ---
  console.log('--- PVM Contract (resolc) @ ' + PVM_ADDR + ' ---');
  try {
    const pvm = new ethers.Contract(PVM_ADDR, pvmAbi, provider);
    const r = await pvm.hashLeaf(LEAF);
    console.log('  hashLeaf result:', r);
    if (r === '0x' || r === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('  ⚠️  WARNING: Zero return — contract may not be working correctly');
    } else {
      console.log('  ✅ PVM contract is callable and returns non-zero hash');
    }
  } catch (e) {
    console.error('  ❌ PVM call FAILED:', e.message);
  }

  console.log('');

  // --- REVM ---
  console.log('--- REVM Contract (solidity) @ ' + SOL_ADDR + ' ---');
  try {
    const sol = new ethers.Contract(SOL_ADDR, solAbi, provider);
    const r = await sol.hashLeafSol(LEAF);
    console.log('  hashLeafSol result:', r);
    if (r === '0x' || r === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('  ⚠️  WARNING: Zero return — contract may not be working correctly');
    } else {
      console.log('  ✅ REVM contract is callable and returns non-zero hash');
    }
  } catch (e) {
    console.error('  ❌ REVM call FAILED:', e.message);
  }

  console.log('');

  // --- Cross-verify: both should return the SAME hash for the same input ---
  console.log('--- Cross-verification ---');
  try {
    const pvm = new ethers.Contract(PVM_ADDR, pvmAbi, provider);
    const sol = new ethers.Contract(SOL_ADDR, solAbi, provider);
    const [pvmResult, solResult] = await Promise.all([
      pvm.hashLeaf(LEAF),
      sol.hashLeafSol(LEAF),
    ]);
    if (pvmResult === solResult) {
      console.log('  ✅ Both contracts return identical hash — logic is equivalent');
      console.log('  Hash:', pvmResult);
    } else {
      console.log('  ⚠️  Hashes differ!');
      console.log('  PVM:', pvmResult);
      console.log('  SOL:', solResult);
    }
  } catch (e) {
    console.error('  ❌ Cross-verification failed:', e.message);
  }
})();
