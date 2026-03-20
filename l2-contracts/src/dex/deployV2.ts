import * as hre from "hardhat";
import { ethers } from "ethers";
import { Provider, Wallet, ContractFactory } from "zksync-ethers";
import { writeDeploymentsArtifact } from "./writeDeployments";
import { ViaDeploymentArtifact } from "./types";

function hashL2Bytecode(bytecode: ethers.BytesLike): Uint8Array {
  const bytecodeAsArray = ethers.utils.arrayify(bytecode);
  if (bytecodeAsArray.length % 32 != 0) throw new Error("The bytecode length in bytes must be divisible by 32");
  const hashStr = ethers.utils.sha256(bytecodeAsArray);
  const hash = ethers.utils.arrayify(hashStr);
  const bytecodeLengthInWords = bytecodeAsArray.length / 32;
  if (bytecodeLengthInWords % 2 == 0) throw new Error("Bytecode length in 32-byte words must be odd");
  const bytecodeLength = ethers.utils.arrayify(bytecodeLengthInWords);
  if (bytecodeLength.length > 2) throw new Error("Bytecode length must be less than 2^16 bytes");
  const bytecodeLengthPadded = ethers.utils.zeroPad(bytecodeLength, 2);
  const codeHashVersion = new Uint8Array([1, 0]);
  hash.set(codeHashVersion, 0);
  hash.set(bytecodeLengthPadded, 2);
  return hash;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

async function main() {
  const chainId = Number(process.env.VIA_CHAIN_ID || 25223);
  const rpcUrl = process.env.VIA_TESTNET_RPC_URL || "https://via.testnet.viablockchain.dev";
  const explorerBaseUrl = process.env.VIA_EXPLORER_URL || "https://testnet.blockscout.onvia.org";
  const privateKeyRaw = req("PRIVATE_KEY");
  const privateKey = privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`;
  const wbtcAddress = req("WBTC_ADDRESS");

  if (chainId !== 25223 && chainId !== 5223) {
    throw new Error(`Unsupported chainId=${chainId}. Expected 25223 or 5223.`);
  }

  const provider = new Provider(rpcUrl);
  const deployer = new Wallet(privateKey, provider);
  const feeToSetter = process.env.FEE_TO_SETTER || deployer.address;

  console.log(`chainId=${chainId}`);
  console.log(`deployer=${deployer.address}`);
  console.log(`wbtc=${wbtcAddress}`);
  console.log(`balanceWei=${(await deployer.getBalance()).toString()}`);

  const pairArtifact = await hre.artifacts.readArtifact("UniswapV2Pair");
  const pairBytecodeHash = ethers.utils.hexlify(hashL2Bytecode(pairArtifact.bytecode));

  // Deploy Factory (with pair bytecode in factoryDeps)
  const factoryArtifact = await hre.artifacts.readArtifact("UniswapV2Factory");
  const factoryFactory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, deployer);
  const factory = await factoryFactory.deploy(feeToSetter, {
    customData: {
      factoryDeps: [pairArtifact.bytecode],
      gasPerPubdata: 50000,
    },
  } as any);
  await factory.deployed();

  // Deploy Router02(factory, wbtc)
  const routerArtifact = await hre.artifacts.readArtifact("UniswapV2Router02");
  const routerFactory = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, deployer);
  const router = await routerFactory.deploy(factory.address, wbtcAddress);
  await router.deployed();

  // Deploy Multicall2
  const multicallArtifact = await hre.artifacts.readArtifact("Multicall2");
  const multicallFactory = new ContractFactory(multicallArtifact.abi, multicallArtifact.bytecode, deployer);
  const multicall = await multicallFactory.deploy();
  await multicall.deployed();

  const artifact: ViaDeploymentArtifact = {
    chainId: chainId as 25223 | 5223,
    rpcUrl,
    explorerBaseUrl,
    contracts: {
      v2: {
        router02: router.address,
        factory: factory.address,
        wbtc: wbtcAddress,
        multicall: multicall.address,
        pairBytecodeHash,
      },
    },
    meta: {
      deployedAt: new Date().toISOString(),
      gitCommit: process.env.GIT_COMMIT || "",
      compiler: {
        solc: process.env.SOLC_VERSIONS || "0.5.16,0.6.6,0.8.24",
        zksolc: process.env.ZKSOLC_VERSION || "1.5.13",
      },
      feeToSetter,
    },
  };

  const fileName = chainId === 25223 ? "via-testnet-25223.json" : "via-mainnet-5223.json";
  const outPath = writeDeploymentsArtifact(fileName, artifact);

  console.log(`factory=${factory.address}`);
  console.log(`router02=${router.address}`);
  console.log(`multicall=${multicall.address}`);
  console.log(`pairBytecodeHash=${pairBytecodeHash}`);
  console.log(`artifact=${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
