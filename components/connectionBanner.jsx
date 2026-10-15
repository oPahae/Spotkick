import { useRouter } from "next/router";
import { Loader2, WifiOff, MonitorSmartphone } from "lucide-react";
import { useMatch } from "../lib/matchContext";
import { useAuth } from "../lib/authContext";

export default function ConnectionBanner() {
  const { connection } = useMatch();
  const { user } = useAuth();
  const router = useRouter();
  if (!user || router.pathname === "/" || router.pathname === "/login" || router.pathname === "/register") return null;
  if (connection === "connected" || connection === "idle") return null;
  const replaced = connection === "replaced";
  return (
    <div role="status" className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 animate-slideDown items-center gap-3 rounded-full bg-ink-900/95 px-5 py-2.5 text-sm font-semibold text-chalk shadow-2xl ring-1 ring-siren-500/60 backdrop-blur">
      {replaced ? (
        <>
          <MonitorSmartphone className="h-4 w-4 text-siren-400" aria-hidden="true" />
          Signed in on another tab. Reload this page to play here.
        </>
      ) : (
        <>
          {connection === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WifiOff className="h-4 w-4 text-siren-400" aria-hidden="true" />}
          {connection === "connecting" ? "Connecting to the server" : "Connection lost. Reconnecting"}
        </>
      )}
    </div>
  );
}
