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

export async function runBridge(params: {
  wallet: ConnectedWallet;
  direction: BridgeDirection;
  amount: string;
  onEvent: (event: BridgeStepEvent) => void;
}) {
  const wallet = params.wallet;
  const direction = params.direction;
  const amount = params.amount;
  const onEvent = params.onEvent;

  const unsubscribe: any = (kit as any).on("*", function (payload: any) {
    onEvent({
      id:
        (payload && payload.values && payload.values.name
          ? payload.values.name
          : payload && payload.method
          ? payload.method
          : "event") +
        "-" +
        (payload && payload.values && payload.values.txHash
          ? payload.values.txHash
          : Date.now()),
      name:
        payload && payload.values && payload.values.name
          ? payload.values.name
          : payload && payload.method
          ? payload.method
          : "event",
      state:
        payload && payload.values && payload.values.state
          ? payload.values.state
          : "pending",
      txHash:
        payload && payload.values && payload.values.txHash
          ? payload.values.txHash
          : payload && payload.values && payload.values.data
          ? payload.values.data.txHash
          : undefined,
      explorerUrl:
        payload && payload.values ? payload.values.explorerUrl : undefined,
      raw: payload,
    });
  });

  try {
    let result: any = await (kit as any).bridge({
      from: { adapter: wallet.adapter, chain: CHAINS[direction.from] },
      to: { adapter: wallet.adapter, chain: CHAINS[direction.to] },
      amount: amount,
    });

    if (result && result.state === "error") {
      result = await (kit as any).retryBridge(result, {
        from: wallet.adapter,
        to: wallet.adapter,
      });
    }

    return result;
  } finally {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  }
}  amount: string;
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
