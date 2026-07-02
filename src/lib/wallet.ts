import type { EIP1193Provider } from "viem";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
};

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EIP6963ProviderDetail>;
  }
}

export async function discoverBrowserWallets(): Promise<
  EIP6963ProviderDetail[]
> {
  const providers = new Map<string, EIP6963ProviderDetail>();

  const handleProviderAnnouncement = (
    event: WindowEventMap["eip6963:announceProvider"],
  ) => {
    providers.set(event.detail.info.uuid, event.detail);
  };

  window.addEventListener(
    "eip6963:announceProvider",
    handleProviderAnnouncement,
  );
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  await new Promise((resolve) => window.setTimeout(resolve, 250));
  window.removeEventListener(
    "eip6963:announceProvider",
    handleProviderAnnouncement,
  );

  return [...providers.values()];
}

async function requestAccounts(provider: EIP1193Provider) {
  await provider.request({
    method: "eth_requestAccounts",
    params: undefined,
  });

  const accounts = (await provider.request({
    method: "eth_accounts",
    params: undefined,
  })) as string[];

  return accounts[0] ?? null;
}

export type ConnectedWallet = {
  adapter: Awaited<ReturnType<typeof createViemAdapterFromProvider>>;
  address: string;
  walletName: string;
  provider: EIP1193Provider;
};

export async function connectBrowserWallet(
  preferredName = "MetaMask",
): Promise<ConnectedWallet> {
  const providers = await discoverBrowserWallets();

  if (providers.length === 0) {
    throw new Error(
      "No EIP-6963 browser wallet found. Install MetaMask or another compatible wallet.",
    );
  }

  const selected =
    providers.find(
      ({ info }) =>
        info.rdns === "io.metamask" || info.name === preferredName,
    ) ?? providers[0];

  const address = await requestAccounts(selected.provider);
  if (!address) {
    throw new Error("Wallet connected but returned no account.");
  }

  const adapter = await createViemAdapterFromProvider({
    provider: selected.provider,
  });

  return {
    adapter,
    address,
    walletName: selected.info.name,
    provider: selected.provider,
  };
}
