import { artifacts } from "hardhat";
import { ethers } from "ethers";
function hashL2Bytecode(bytecode: ethers.BytesLike): Uint8Array {
  const bytecodeAsArray = ethers.utils.arrayify(bytecode);
  if (bytecodeAsArray.length % 32 != 0) {
    throw new Error("The bytecode length in bytes must be divisible by 32");
  }

  const hashStr = ethers.utils.sha256(bytecodeAsArray);
  const hash = ethers.utils.arrayify(hashStr);
  const bytecodeLengthInWords = bytecodeAsArray.length / 32;
  if (bytecodeLengthInWords % 2 == 0) {
    throw new Error("Bytecode length in 32-byte words must be odd");
  }
  const bytecodeLength = ethers.utils.arrayify(bytecodeLengthInWords);
  if (bytecodeLength.length > 2) {
    throw new Error("Bytecode length must be less than 2^16 bytes");
  }
  const bytecodeLengthPadded = ethers.utils.zeroPad(bytecodeLength, 2);
  const codeHashVersion = new Uint8Array([1, 0]);
  hash.set(codeHashVersion, 0);
  hash.set(bytecodeLengthPadded, 2);
  return hash;
}

/**
 * Reads UniswapV2Pair artifact bytecode and prints zkSync bytecode hash (0x0100... format).
 *
 * NOTE: Artifact name/path may differ depending on how core contracts are vendored.
 * Override with env: PAIR_ARTIFACT_NAME (default: UniswapV2Pair)
 */
async function main() {
  const artifactName = process.env.PAIR_ARTIFACT_NAME || "UniswapV2Pair";
  const pairArtifact = await artifacts.readArtifact(artifactName);
  const pairBytecodeHash = ethers.utils.hexlify(hashL2Bytecode(pairArtifact.bytecode));

  console.log(`artifact=${artifactName}`);
  console.log(`pairBytecodeHash=${pairBytecodeHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
