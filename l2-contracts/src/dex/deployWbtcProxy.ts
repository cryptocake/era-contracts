import * as hre from "hardhat";
import { ethers } from "ethers";
import { Provider, Wallet, ContractFactory, Contract } from "zksync-ethers";

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function assertNonZeroAddress(label: string, value: string) {
  if (!ethers.utils.isAddress(value)) {
    throw new Error(`${label} is not a valid address: ${value}`);
  }
  if (value.toLowerCase() === ethers.constants.AddressZero.toLowerCase()) {
    throw new Error(`${label} must be non-zero`);
  }
}

async function main() {
  const rpcUrl = process.env.VIA_TESTNET_RPC_URL || "https://via.testnet.viablockchain.dev";
  const privateKey = req("PRIVATE_KEY");
  const l2BridgeAddress = req("L2_BRIDGE_ADDRESS");
  const l1TokenAddress = req("L1_TOKEN_ADDRESS");

  assertNonZeroAddress("L2_BRIDGE_ADDRESS", l2BridgeAddress);
  assertNonZeroAddress("L1_TOKEN_ADDRESS", l1TokenAddress);

  const provider = new Provider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const proxyAdmin = process.env.PROXY_ADMIN_ADDRESS || wallet.address;

  assertNonZeroAddress("PROXY_ADMIN_ADDRESS", proxyAdmin);

  const balance = await wallet.getBalance();
  console.log(`deployer=${wallet.address}`);
  console.log(`proxyAdmin=${proxyAdmin}`);
  console.log(`balanceWei=${balance.toString()}`);

  const implArtifact = await hre.artifacts.readArtifact("L2WrappedBaseToken");
  const implFactory = new ContractFactory(implArtifact.abi, implArtifact.bytecode, wallet);
  const impl = await implFactory.deploy();
  await impl.deployed();
  const implAddress = impl.address;

  const proxyArtifact = await hre.artifacts.readArtifact(
    "@openzeppelin/contracts-v4/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
  );

  const iface = new ethers.utils.Interface(implArtifact.abi);
  const initData = iface.encodeFunctionData("initializeV2", [
    "Wrapped BTC",
    "WBTC",
    l2BridgeAddress,
    l1TokenAddress,
  ]);

  const proxyFactory = new ContractFactory(proxyArtifact.abi, proxyArtifact.bytecode, wallet);
  const proxy = await proxyFactory.deploy(implAddress, proxyAdmin, initData);
  await proxy.deployed();
  const proxyAddress = proxy.address;

  // Transparent proxy blocks fallback calls from admin.
  // Use a non-admin read signer for metadata verification.
  const readWallet = Wallet.createRandom().connect(provider);
  const wbtc = new Contract(proxyAddress, implArtifact.abi, readWallet);
  const name = await wbtc.name();
  const symbol = await wbtc.symbol();
  const decimals = await wbtc.decimals();

  console.log(`WBTC_IMPL=${implAddress}`);
  console.log(`WBTC_PROXY=${proxyAddress}`);
  console.log(`NAME=${name}`);
  console.log(`SYMBOL=${symbol}`);
  console.log(`DECIMALS=${decimals.toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
