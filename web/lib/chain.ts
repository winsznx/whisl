import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import { whislEscrowAbi } from "./whislEscrowAbi";
import deployments from "./deployments.json";

export const DEPLOY = deployments.sepolia;
export const ESCROW = DEPLOY.whislEscrow as Address;
export const USDT = DEPLOY.usdt as Address;
export const CHAIN_ID = DEPLOY.chainId;
export const RPC = DEPLOY.rpc;
export const EXPLORER = "https://sepolia.etherscan.io";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC),
});

export const usdtAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export type PotView = {
  creator: Address;
  matchId: `0x${string}`;
  conditionHash: `0x${string}`;
  token: Address;
  requiredConfirmer: Address;
  payoutRecipient: Address;
  minTotalDeposit: bigint;
  maxTotalDeposit: bigint;
  fundingDeadline: bigint;
  resolutionDeadline: bigint;
  disputeWindowSeconds: bigint;
  disputeGraceSeconds: bigint;
  unclaimedSweepSeconds: bigint;
  totalDeposited: bigint;
  confirmedAt: bigint;
  disputedAt: bigint;
  finalizedAt: bigint;
  resultHash: `0x${string}`;
  evidenceHash: `0x${string}`;
  state: number;
};

export async function readPot(potId: `0x${string}`): Promise<PotView> {
  const p = (await publicClient.readContract({
    address: ESCROW,
    abi: whislEscrowAbi,
    functionName: "getPot",
    args: [potId],
  })) as unknown as PotView;
  return { ...p, state: Number(p.state) };
}

export async function readPotState(potId: `0x${string}`): Promise<number> {
  const s = await publicClient.readContract({ address: ESCROW, abi: whislEscrowAbi, functionName: "potStateOf", args: [potId] });
  return Number(s);
}

export async function readDepositors(potId: `0x${string}`): Promise<Address[]> {
  return (await publicClient.readContract({ address: ESCROW, abi: whislEscrowAbi, functionName: "depositors", args: [potId] })) as Address[];
}

export async function readDepositOf(potId: `0x${string}`, account: Address): Promise<bigint> {
  return (await publicClient.readContract({ address: ESCROW, abi: whislEscrowAbi, functionName: "depositOf", args: [potId, account] })) as bigint;
}

export async function readUsdtBalance(account: Address): Promise<bigint> {
  return (await publicClient.readContract({ address: USDT, abi: usdtAbi, functionName: "balanceOf", args: [account] })) as bigint;
}
