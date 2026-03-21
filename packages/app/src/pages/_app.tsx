import '@transcript/styles/globals.css';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { Geist, Geist_Mono } from 'next/font/google';
import Head from 'next/head';
import { FC } from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const App: FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <>
      <Head>
        <title>Transcript</title>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <QueryClientProvider client={new QueryClient()}>
        <div className={`${geistSans.className} ${geistMono.className}`}>
          <Component {...pageProps} />
        </div>
      </QueryClientProvider>
    </>
  );
};

export default App;
