import '@/styles/globals.css';

import { NearProvider } from 'near-connect-hooks';
import { NetworkId } from '@/config';
import { Navigation } from '@/components/Navigation';

export default function App({ Component, pageProps }) {
  return (
    <NearProvider config={{ network: NetworkId }}>
      <Navigation />
      <Component {...pageProps} />
    </NearProvider>
  );
}
