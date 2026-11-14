import Head from "next/head";
import "../styles/globals.css";
import { AuthProvider, useAuth } from "../lib/authContext";
import { MatchProvider } from "../lib/matchContext";
import BootGate from "../components/bootGate";
import ConnectionBanner from "../components/connectionBanner";
import { PartyProvider } from "../lib/partyContext";
import PartyInvite from "../components/partyInvite";

function Shell({ Component, pageProps, route }) {
  const auth = useAuth();
  return (
    <BootGate auth={auth}>
      <MatchProvider>
        <PartyProvider>
          <div key={route} className="animate-pageIn">
            <Component {...pageProps} />
          </div>
          <ConnectionBanner />
          <PartyInvite />
        </PartyProvider>
      </MatchProvider>
    </BootGate>
  );
}

export default function App({ Component, pageProps, router }) {
  return (
    <>
      <Head>
        <title>Spot Kick - Penalty Shootout</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Real-time 1v1 multiplayer 3D penalty shootout." />
      </Head>
      <AuthProvider>
        <Shell Component={Component} pageProps={pageProps} route={router.pathname} />
      </AuthProvider>
    </>
  );
}
