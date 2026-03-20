# WBTC Deployment Handoff (Via Testnet)

Goal: deploy canonical `L2WrappedBaseToken` (proxy) so DEX integration can continue.

## Repo / Branch
- Repo: `cryptocake/era-contracts`
- Branch: `feat/via-uniswap-v2-deployments`
- Working folder: `l2-contracts`

## Deployment mode
Use **DEX-ready mode** now:
- Deploy `L2WrappedBaseToken` implementation + proxy
- Initialize as `Wrapped BTC` / `WBTC`
- Ensure ERC20 + deposit/withdraw work

## 1) Environment
Create `l2-contracts/.env`:

```env
VIA_TESTNET_RPC_URL=https://via.testnet.viablockchain.dev
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
```

## 2) Critical config check (before compile)
In `l2-contracts/hardhat.config.ts`, ensure zksolc is not using system-contract mode for this deployment:

```ts
zksolc: {
  version: "1.5.0",
  compilerSource: "binary",
  settings: {
    isSystem: false,
  },
},
```

(Or remove `isSystem` entirely.)

## 3) Compile (clean rebuild)
From `era-contracts/l2-contracts`:

```bash
npx hardhat clean
npx hardhat compile
```

## 4) Deploy implementation + proxy
Start console:

```bash
npx hardhat console --network viaTestnet
```

Use zkSync deployer path:

```js
const hre = require("hardhat")
const { Wallet } = require("zksync-ethers")
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy")

const pk = process.env.PRIVATE_KEY
if (!pk) throw new Error("Missing PRIVATE_KEY in env")

const wallet = new Wallet(pk, hre.ethers.provider)
const deployer = new Deployer(hre, wallet)
```

Optional balance check with direct provider:

```js
const { Provider, Wallet: ZkWallet } = require("zksync-ethers")
const rpc = process.env.VIA_TESTNET_RPC_URL || "https://via.testnet.viablockchain.dev"
const provider = new Provider(rpc)
const checkWallet = new ZkWallet(process.env.PRIVATE_KEY, provider)
(await checkWallet.getBalance()).toString()
```

Deploy implementation:

```js
const implArtifact = await deployer.loadArtifact("L2WrappedBaseToken")
const impl = await deployer.deploy(implArtifact)
console.log("WBTC_IMPL:", impl.address)
```

Deploy proxy with atomic initialization:

```js
const proxyArtifact = await deployer.loadArtifact(
  "@openzeppelin/contracts-v4/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
)

const iface = new hre.ethers.utils.Interface(implArtifact.abi)

const l2BridgeAddress = "<SAFE_L2_BRIDGE_SENTINEL_OR_REAL_BRIDGE>"
const l1TokenAddress  = "<L1_BTC_OR_PLACEHOLDER_NONZERO>"

const initData = iface.encodeFunctionData("initializeV2", [
  "Wrapped BTC",
  "WBTC",
  l2BridgeAddress,
  l1TokenAddress,
])

const proxy = await deployer.deploy(proxyArtifact, [
  impl.address,
  wallet.address,
  initData,
])

console.log("WBTC_PROXY:", proxy.address)
```

## 5) If not using atomic init
If initData was not passed during proxy deploy, initialize manually:

```js
const wbtc = await hre.ethers.getContractAt("L2WrappedBaseToken", proxy.address, wallet)
const tx = await wbtc.initializeV2("Wrapped BTC", "WBTC", l2BridgeAddress, l1TokenAddress)
await tx.wait()
console.log("initialize tx:", tx.hash)
```

## 6) Verify

```js
const wbtc = await hre.ethers.getContractAt("L2WrappedBaseToken", proxy.address, wallet)
await wbtc.name()      // Wrapped BTC
await wbtc.symbol()    // WBTC
await wbtc.decimals()  // 18
```

```js
let d = await wbtc.deposit({ value: 1 })
await d.wait()
let w = await wbtc.withdraw(1)
await w.wait()
```

## 7) Return values needed
- `WBTC_PROXY` (this is `WBTC_ADDRESS`)
- `initializeV2` tx hash (if done manually)
- metadata check outputs

Then continue with `l2-contracts/src/dex/deployV2.ts`.
