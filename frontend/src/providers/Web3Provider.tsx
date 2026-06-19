"use client";

if (typeof window === "undefined") {
  (global as any).indexedDB = {
    open: () => ({}),
  };
}

import React, { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const hoodi = defineChain({
  id: 560048,
  name: "Hoodi Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://hoodi.drpc.org"] },
  },
});

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "";

const connectors = [
  injected(),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

const config = createConfig({
  chains: [hoodi],
  connectors,
  ssr: true,
  transports: {
    [hoodi.id]: http("https://hoodi.drpc.org"),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
