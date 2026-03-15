const fs = require('fs');
const path = require('path');
const { resolc } = require(path.resolve(__dirname, '../../node_modules/@parity/resolc/dist/resolc.js'));

async function main() {
    const contractPath = path.resolve(__dirname, 'contracts/PVMark.sol');
    const source = fs.readFileSync(contractPath, 'utf8');
    const simplePath = path.resolve(__dirname, 'contracts/Simple.sol');
    const simpleSource = fs.readFileSync(simplePath, 'utf8');
    const pvmPath = path.resolve(__dirname, 'contracts/PVMarkPVM.sol');
    const pvmSource = fs.readFileSync(pvmPath, 'utf8');
    
    // Construct the standard JSON input for resolc
    const input = JSON.stringify({
        language: 'Solidity',
        sources: {
            'contracts/PVMark.sol': { content: source },
            'contracts/Simple.sol': { content: simpleSource },
            'contracts/PVMarkPVM.sol': { content: pvmSource }
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            outputSelection: {
                '*': {
                    '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
                }
            }
        }
    });

    console.log('Compiling PVMark.sol with resolc (low-level)...');
    try {
        const output = resolc(input);
        
        if (output.errors) {
            output.errors.forEach(err => {
                if (err.severity === 'error') {
                    console.error(err.formattedMessage);
                } else {
                    console.warn(err.formattedMessage);
                }
            });
        }

        console.log('Output keys:', Object.keys(output));
        
        if (output.contracts) {
            console.log('Contract files:', Object.keys(output.contracts));
            for (const fileKey in output.contracts) {
                const fileContracts = output.contracts[fileKey];
                console.log(`Contracts in ${fileKey}:`, Object.keys(fileContracts));
                
                for (const name in fileContracts) {
                    const contract = fileContracts[name];
                    console.log(`Contract "${name}" keys:`, Object.keys(contract));
                    
                    const pvmBytecode = contract.evm?.bytecode?.object;
                    const deployedBytecode = contract.evm?.deployedBytecode?.object;
                    
                    if (pvmBytecode) {
                        const binPath = path.resolve(__dirname, `bin/${name}.polkavm`);
                        fs.mkdirSync(path.dirname(binPath), { recursive: true });
                        fs.writeFileSync(binPath, Buffer.from(pvmBytecode, 'hex'));
                        console.log(`Successfully wrote ${name}.polkavm to bin/`);
                        
                        // Also write ABI
                        const abiPath = path.resolve(__dirname, `bin/${name}.abi.json`);
                        fs.writeFileSync(abiPath, JSON.stringify(contract.abi, null, 2));
                    }
                }
            }
        } else {
            console.error('No contracts found in output.');
            if (output.errors && output.errors.some(e => e.severity === 'error')) {
                process.exit(1);
            }
        }
    } catch (err) {
        console.error('Compilation failed:', err);
        process.exit(1);
    }
}

main();
