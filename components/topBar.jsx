import Link from "next/link";
import { useRouter } from "next/router";
import { LogOut, Trophy, Home } from "lucide-react";
import Logo from "./logo";
import Avatar from "./avatar";
import { useAuth } from "../lib/authContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const link = (href, label, Icon) => {
    const active = router.pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-flare-400 ${active ? "bg-white/10 text-chalk" : "text-chalk/60 hover:bg-white/5 hover:text-chalk"}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Logo href="/home" />
      <nav className="flex items-center gap-1.5" aria-label="Main">
        {link("/home", "Home", Home)}
        {link("/leaderboard", "Leaderboard", Trophy)}
        {user ? (
          <div className="ml-2 flex items-center gap-3 border-l border-white/10 pl-4">
            <Avatar username={user.username} sex={user.sex} image={user.image} size={36} />
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-chalk/60 outline-none transition hover:bg-white/5 hover:text-chalk focus-visible:ring-2 focus-visible:ring-flare-400"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
