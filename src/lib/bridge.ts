import { AppKit } from "@circle-fin/app-kit";
import type { ConnectedWallet } from "./wallet";

export const CHAINS = {
  arc: "Arc_Testnet",
  ethereum: "Ethereum_Sepolia",
} as const;

export type ChainKey = keyof typeof CHAINS;
export type BridgeDirection = { from: ChainKey; to: ChainKey };

export type BridgeStepEvent = {
  id: string;
  name: string;
  state: "pending" | "success" | "error" | string;
  txHash?: string;
  explorerUrl?: string;
  raw: unknown;
};

export const kit = new AppKit();

/**
 * Runs a bridge transfer between Arc Testnet and Ethereum Sepolia using a
 * single connected browser wallet for both legs. CCTP handles the
 * approve -> burn -> attest -> mint lifecycle; this function just wires
 * App Kit's event stream to a UI-friendly callback.
 */
export async function runBridge({
  wallet,
  direction,
  amount,
  onEvent,
}: {
  wallet: ConnectedWallet;
  direction: BridgeDirection;
  amount: string;
  onEvent: (event: BridgeStepEvent) => void;
}) {
  const unsubscribe = kit.on("*", (payload: any) => {
    onEvent({
      id: `${payload?.values?.name ?? payload?.method ?? "event"}-${
        payload?.values?.txHash ?? Date.now()
      }`,
      name: payload?.values?.name ?? payload?.method ?? "event",
      state: payload?.values?.state ?? "pending",
      txHash: payload?.values?.txHash ?? payload?.values?.data?.txHash,
      explorerUrl: payload?.values?.explorerUrl,
      raw: payload,
    });
  });

  try {
    let result = await kit.bridge({
      from: { adapter: wallet.adapter, chain: CHAINS[direction.from] },
      to: { adapter: wallet.adapter, chain: CHAINS[direction.to] },
      amount,
    });

    if (result.state === "error") {
      result = await kit.retryBridge(result, {
        from: wallet.adapter,
        to: wallet.adapter,
      });
    }

    return result;
  } finally {
    unsubscribe?.();
  }
}
