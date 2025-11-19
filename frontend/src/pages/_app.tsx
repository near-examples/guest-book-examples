import "@/styles/globals.css";

import type { AppProps } from "next/app";
import { Navigation } from "@/components/Navigation";
import { NearProvider } from "@/hooks/useNearWallet";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NearProvider>
      <Navigation />
      <Component {...pageProps} />
    </NearProvider>
  );
}
