import { useMemo, useState } from "react";
import { connectBrowserWallet, type ConnectedWallet } from "./lib/wallet";
import { runBridge, type BridgeDirection, type BridgeStepEvent } from "./lib/bridge";

const STEP_ORDER = ["approve", "burn", "fetchAttestation", "mint"] as const;
type StepId = (typeof STEP_ORDER)[number];

const STEP_LABEL: Record<StepId, string> = {
  approve: "Approve",
  burn: "Burn",
  fetchAttestation: "Attest",
  mint: "Mint",
};

const CHAIN_META = {
  arc: { label: "Arc Testnet", sub: "USDC-native gas, sub-second finality" },
  ethereum: { label: "Ethereum Sepolia", sub: "CCTP v2 message source" },
};

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function App() {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [direction, setDirection] = useState<BridgeDirection>({
    from: "ethereum",
    to: "arc",
  });
  const [amount, setAmount] = useState("1.00");
  const [connecting, setConnecting] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepState, setStepState] = useState<Record<string, BridgeStepEvent>>({});
  const [log, setLog] = useState<BridgeStepEvent[]>([]);

  const activeStepIndex = useMemo(() => {
    let idx = -1;
    STEP_ORDER.forEach((s, i) => {
      if (stepState[s] && stepState[s].state === "success") idx = i;
    });
    return idx;
  }, [stepState]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const w = await connectBrowserWallet();
      setWallet(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }

  function flipDirection() {
    setDirection((d) => ({ from: d.to, to: d.from }));
    setStepState({});
    setLog([]);
  }

  async function handleBridge() {
    if (!wallet) return;
    setError(null);
    setRunning(true);
    setStepState({});
    setLog([]);
    try {
      await runBridge({
        wallet: wallet,
        direction: direction,
        amount: amount,
        onEvent: (evt) => {
          setLog((prev) => [evt, ...prev].slice(0, 30));
          setStepState((prev) => ({ ...prev, [evt.name]: evt }));
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bridge transfer failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Arc to Ethereum</span>
        </div>  const [log, setLog] = useState<BridgeStepEvent[]>([]);

  const activeStepIndex = useMemo(() => {
    let idx =
