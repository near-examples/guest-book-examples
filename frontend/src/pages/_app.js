import '@/styles/globals.css';

import { NetworkId } from '@/config';
import { Navigation } from '@/components/Navigation';
import { NearProvider } from '@/components/near-provider';

export default function App({ Component, pageProps }) {
  return (
    <NearProvider>
      <Navigation />
      <Component {...pageProps} />
    </NearProvider>
  );
}
