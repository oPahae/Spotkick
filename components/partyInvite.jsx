import { useRouter } from "next/router";
import { UserPlus, X } from "lucide-react";
import Avatar from "./avatar";
import Button from "./button";
import { useParty } from "../lib/partyContext";

export default function PartyInvite() {
  const { invites, game, actions } = useParty();
  const router = useRouter();
  if (!invites.length || (game && game.net && router.pathname === "/match")) return null;
  const inv = invites[0];
  const accept = async () => {
    try {
      await actions.join(inv.code);
      router.push("/match");
    } catch (err) {
      actions.dismissInvite(inv.code);
    }
  };
  return (
    <div role="alertdialog" aria-label="Party invitation" className="fixed right-4 top-20 z-[110] w-[22rem] animate-slideDown rounded-2xl bg-ink-900/95 p-4 shadow-2xl ring-1 ring-flare-500/50 backdrop-blur">
      <div className="flex items-start gap-3">
        <Avatar username={inv.from.username} sex={inv.from.sex} image={inv.from.image} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-flare-400"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Party invitation</p>
          <p className="mt-1 truncate font-semibold">{inv.from.username} invites you to a 6v6 match</p>
        </div>
        <button type="button" onClick={() => actions.dismissInvite(inv.code)} aria-label="Dismiss" className="rounded-lg p-1 text-chalk/50 hover:bg-white/10 hover:text-chalk">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={accept}>Join</Button>
        <Button size="sm" variant="ghost" onClick={() => actions.dismissInvite(inv.code)}>Decline</Button>
      </div>
    </div>
  );
}
