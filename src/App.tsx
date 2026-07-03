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
  arc: { label: "Arc Testnet", sub: "USDC native gas" },
  ethereum: { label: "Ethereum Sepolia", sub: "CCTP v2 source" },
};

function short(addr: string) {
  return addr.slice(0, 6) + "...." + addr.slice(-4);
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
    for (let i = 0; i < STEP_ORDER.length; i++) {
      const s = STEP_ORDER[i];
      if (stepState[s] && stepState[s].state === "success") {
        idx = i;
      }
    }
    return idx;
  }, [stepState]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const w = await connectBrowserWallet();
      setWallet(w);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to connect wallet.");
      }
    } finally {
      setConnecting(false);
    }
  }

  function flipDirection() {
    setDirection({ from: direction.to, to: direction.from });
    setStepState({});
    setLog([]);
  }

  async function handleBridge() {
    if (!wallet) {
      return;
    }
    setError(null);
    setRunning(true);
    setStepState({});
    setLog([]);
    try {
      await runBridge({
        wallet: wallet,
        direction: direction,
        amount: amount,
        onEvent: function (evt) {
          setLog(function (prev) {
            return [evt].concat(prev).slice(0, 30);
          });
          setStepState(function (prev) {
            const next = Object.assign({}, prev);
            next[evt.name] = evt;
            return next;
          });
        },
      });
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Bridge transfer failed.");
      }
    } finally {
      setRunning(false);
    }
  }

  let walletLabel = "Connect wallet";
  if (wallet) {
    walletLabel = wallet.walletName + " " + short(wallet.address);
  } else if (connecting) {
    walletLabel = "Connecting";
  }

  let bridgeLabel = "Bridge " + (amount || "0") + " USDC";
  if (running) {
    bridgeLabel = "Bridging";
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Arc to Ethereum</span>
        </div>
        <button
          className="wallet-btn"
          onClick={handleConnect}
          disabled={connecting || Boolean(wallet)}
        >
          {walletLabel}
        </button>
      </header>

      <main className="stage">
        <div className="stage-head">
          <p className="eyebrow">USDC settlement rail testnet</p>
          <h1>Move USDC between Arc and Ethereum.</h1>
          <p className="lede">
            Backed by Circle CCTP. Every transfer burns USDC on the source
            chain, waits for attestation, then mints natively on the
            destination.
          </p>
        </div>

        <div className="panel">
          <div className="route">
            <ChainCard which={direction.from} role="From" />
            <button
              className="flip"
              onClick={flipDirection}
              aria-label="Reverse direction"
              disabled={running}
            >
              &#8644;
            </button>
            <ChainCard which={direction.to} role="To" />
          </div>

          <label className="amount-field">
            <span>Amount USDC</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={function (e) {
                setAmount(e.target.value);
              }}
              disabled={running}
            />
          </label>

          <button
            className="bridge-btn"
            onClick={handleBridge}
            disabled={!wallet || running || !amount}
          >
            {bridgeLabel}
          </button>

          {error ? <p className="error">{error}</p> : null}

          <div className="rail" role="list" aria-label="Bridge progress">
            {STEP_ORDER.map(function (step, i) {
              const evt = stepState[step];
              const state = evt ? evt.state : "idle";
              const isActive = i === activeStepIndex + 1 && running;
              const nodeClass =
                "rail-node state-" + state + (isActive ? " active" : "");
              return (
                <div className={nodeClass} key={step} role="listitem">
                  <span className="rail-dot" />
                  <span className="rail-label">{STEP_LABEL[step]}</span>
                  {evt && evt.explorerUrl ? (
                    <a
                      href={evt.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rail-link"
                    >
                      view tx
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {log.length > 0 ? (
          <div className="log">
            <p className="log-title">Event stream</p>
            <ul>
              {log.map(function (evt) {
                const tagClass = "tag tag-" + evt.state;
                return (
                  <li key={evt.id + evt.state}>
                    <span className={tagClass}>{evt.state}</span>
                    <span className="log-name">{evt.name}</span>
                    {evt.txHash ? (
                      <span className="log-hash">{short(evt.txHash)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </main>

      <footer className="foot">
        <span>Arc Testnet plus Ethereum Sepolia, testnet funds only</span>
        <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">
          Get testnet USDC
        </a>
      </footer>
    </div>
  );
}

function ChainCard(props: { which: keyof typeof CHAIN_META; role: string }) {
  const meta = CHAIN_META[props.which];
  const cardClass = "chain-card chain-" + props.which;
  return (
    <div className={cardClass}>
      <span className="chain-role">{props.role}</span>
      <span className="chain-name">{meta.label}</span>
      <span className="chain-sub">{meta.sub}</span>
    </div>
  );
  }
