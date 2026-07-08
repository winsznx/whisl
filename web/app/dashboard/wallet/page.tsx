import { formatEther } from "viem";
import { publicClient, readUsdtBalance, EXPLORER } from "@/lib/chain";
import { usdt } from "@/lib/pot";
import { walletConfigured, walletAddress } from "@/lib/server/wdk";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  if (!walletConfigured()) return <NoWallet />;

  let address = "";
  let eth = "0";
  let usdtBal = "0";
  try {
    address = await walletAddress();
    const [wei, u] = await Promise.all([
      publicClient.getBalance({ address: address as `0x${string}` }),
      readUsdtBalance(address as `0x${string}`),
    ]);
    eth = formatEther(wei);
    usdtBal = usdt(u);
  } catch (e) {
    return <NoWallet error={e instanceof Error ? e.message : "Could not load wallet"} />;
  }

  return (
    <div className="max-w-2xl">
      <span className="tag">YOUR WALLET</span>
      <h1 className="heading-secondary mt-4">This instance signs with your own wallet</h1>
      <p className="text-slate mt-3" style={{ fontSize: "var(--text-body-sm)" }}>
        The seed lives on this machine only. No one else ever holds your pledge or your payout.
      </p>

      <div className="card mt-8">
        <div className="mono-label text-smoke">ADDRESS</div>
        <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" className="break-all block mt-1" style={{ fontWeight: 500 }}>
          {address}
        </a>
        <div className="grid grid-cols-2 gap-6 mt-8">
          <div>
            <div className="mono-label text-smoke">USD-T</div>
            <div className="font-display text-4xl mt-1">{usdtBal}</div>
          </div>
          <div>
            <div className="mono-label text-smoke">SEPOLIA ETH (GAS)</div>
            <div className="font-display text-4xl mt-1">{Number(eth).toFixed(4)}</div>
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="mono-label text-smoke">TESTNET FUNDING</div>
        <p className="text-slate mt-2" style={{ fontSize: "var(--text-body-sm)" }}>
          Top up test USD-T and Sepolia ETH for gas.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <a href="https://dashboard.pimlico.io/test-erc20-faucet" target="_blank" rel="noreferrer" className="btn btn-mint">Test USD-T faucet</a>
          <a href="https://www.alchemy.com/faucets/ethereum-sepolia" target="_blank" rel="noreferrer" className="btn btn-ghost">Sepolia ETH faucet</a>
        </div>
      </div>
    </div>
  );
}

function NoWallet({ error }: { error?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="tag">YOUR WALLET</span>
      <h1 className="heading-secondary mt-4">No wallet on this instance yet</h1>
      <p className="text-slate mt-3">
        Whisl runs one instance per person. Set <span className="mono-label">WHISL_WALLET_SEED</span> to your own
        BIP39 seed in this instance&apos;s environment, then reload. The seed never leaves your machine.
      </p>
      {error ? <p className="mono-label text-smoke mt-4">{error}</p> : null}
    </div>
  );
}
