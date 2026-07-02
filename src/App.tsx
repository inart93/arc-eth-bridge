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
  arc: { label: "Arc Testnet", sub: "USDC-native gas · sub-second finality" },
  ethereum: { label: "Ethereum Sepolia", sub: "CCTP v2 message source" },
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
  const [stepState, setStepState] = useState<Record<string, BridgeStepEvent>>(
    {},
  );
  const [log, setLog] = useState<BridgeStepEvent[]>([]);

  const activeStepIndex = useMemo(() => {
    let idx =
