import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { ethers } from "ethers";

export const SEPOLIA = {
  chainId: 11155111,
  rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  usdt: "0xd077a400968890eacc75cdc901f0356c943e4fdb",
};

/** Load a WDK EVM wallet from a BIP39 seed and return account `index` (default 0). */
export async function loadWallet(seed, { rpc = SEPOLIA.rpc, chainId = SEPOLIA.chainId, index = 0 } = {}) {
  const manager = new WalletManagerEvm(seed, { provider: rpc, chainId });
  const account = await manager.getAccount(index);
  return { manager, account, address: account.address };
}

/** Create a fresh self-custodial wallet per participant (PRD §6.4). Returns its mnemonic once. */
export async function createWallet(opts = {}) {
  const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
  const w = await loadWallet(mnemonic, opts);
  return { ...w, mnemonic };
}

/** Poll for a mined receipt using the WDK read-only account API. */
export async function waitReceipt(account, hash, { timeout = 150000, interval = 3000 } = {}) {
  const start = Date.now();
  for (;;) {
    const rc = await account.getTransactionReceipt(hash);
    if (rc) return rc;
    if (Date.now() - start > timeout) throw new Error("receipt timeout: " + hash);
    await new Promise((r) => setTimeout(r, interval));
  }
}

const DEPOSIT_IFACE = new ethers.Interface(["function deposit(bytes32 potId, uint256 amount)"]);

/**
 * Deposit into a pot as TWO visible, separately-signed steps (operator rule 5): first WDK-signed
 * ERC-20 approve, then WDK-signed deposit — never a single button that hides the approve.
 * Waits for the approve receipt before depositing (deposit's transferFrom needs the allowance set).
 */
export async function approveAndDeposit(account, { escrow, token = SEPOLIA.usdt, potId, amount, chainId = SEPOLIA.chainId }) {
  const approve = await account.approve({ token, spender: escrow, amount });
  const approveRc = await waitReceipt(account, approve.hash);

  const deposit = await account.sendTransaction({
    to: escrow,
    value: 0,
    data: DEPOSIT_IFACE.encodeFunctionData("deposit", [potId, amount]),
    chainId,
  });
  const depositRc = await waitReceipt(account, deposit.hash);

  return {
    approveTx: approve.hash,
    approveStatus: Number(approveRc.status),
    depositTx: deposit.hash,
    depositStatus: Number(depositRc.status),
  };
}
