import { Loader2, WifiOff } from "lucide-react";
import Screen from "./screen";
import Button from "./button";

export default function BootGate({ auth, children }) {
  if (auth.status === "loading") {
    return (
      <Screen art={false}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4" role="status">
          <Loader2 className="h-10 w-10 animate-spin text-flare-500" aria-hidden="true" />
          <p className="font-display text-2xl font-bold uppercase tracking-widest text-chalk/70">Loading</p>
        </div>
      </Screen>
    );
  }
  if (auth.status === "error") {
    return (
      <Screen art={false}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
          <WifiOff className="h-12 w-12 text-siren-400" aria-hidden="true" />
          <h1 className="font-display text-4xl font-extrabold uppercase">Server unreachable</h1>
          <p className="max-w-sm text-chalk/60">{auth.bootError}</p>
          <Button onClick={auth.retry}>Try again</Button>
        </div>
      </Screen>
    );
  }
  return children;
}
