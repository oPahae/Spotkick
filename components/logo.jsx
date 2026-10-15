import Link from "next/link";
import { Target } from "lucide-react";

export default function Logo({ href = "/", className = "" }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-flare-400 rounded-lg ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-flare-500 text-ink-950 shadow-[0_6px_24px_-6px_rgba(255,176,32,0.8)] transition group-hover:rotate-12">
        <Target className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="font-display text-3xl font-extrabold uppercase italic leading-none tracking-wide text-chalk">
        Spot<span className="text-flare-500">Kick</span>
      </span>
    </Link>
  );
}
