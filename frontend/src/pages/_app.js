import '@/styles/globals.css';

import '@near-wallet-selector/modal-ui/styles.css';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { HelloNearContract, NetworkId } from '@/config';
import { WalletSelectorProvider } from '@near-wallet-selector/react-hook';
import { Navigation } from '@/components/Navigation';
 
const walletSelectorConfig = {
  network: NetworkId,
  createAccessKeyFor: HelloNearContract,
  modules: [
    setupMyNearWallet(),
    setupMeteorWallet(),
  ],
}

export default function App({ Component, pageProps }) {

  return (
    <WalletSelectorProvider config={walletSelectorConfig}>
      <Navigation />
      <Component {...pageProps} />
    </WalletSelectorProvider>
  );
}