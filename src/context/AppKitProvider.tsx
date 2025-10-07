import { createAppKit } from "@reown/appkit/react";

import { WagmiProvider } from "wagmi";
import { holesky, mainnet } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import type { ReactNode } from "react";

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from https://dashboard.reown.com
const projectId = "8e02b3ff6b1ea4bf1c0f5df1b2b9aa80";

// 2. Create a metadata object - optional
const metadata = {
  name: "AppKit",
  description: "AppKit Example",
  url: "https://example.com", // origin must match your domain & subdomain
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet as AppKitNetwork,
  holesky as AppKitNetwork,
];

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
});

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
  },
});

export function AppKitProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
