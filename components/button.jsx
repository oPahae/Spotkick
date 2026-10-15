import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-flare-500 text-ink-950 shadow-[0_8px_30px_-8px_rgba(255,176,32,0.7)] hover:bg-flare-400 active:bg-flare-600 focus-visible:ring-flare-300",
  secondary:
    "bg-white/10 text-chalk ring-1 ring-inset ring-white/15 backdrop-blur hover:bg-white/15 active:bg-white/20 focus-visible:ring-white/60",
  ghost: "bg-transparent text-chalk/80 hover:bg-white/10 hover:text-chalk active:bg-white/15 focus-visible:ring-white/60",
  danger:
    "bg-siren-500/90 text-white hover:bg-siren-500 active:bg-siren-500/80 focus-visible:ring-siren-400",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-base",
  lg: "h-14 px-8 text-lg",
  xl: "h-20 px-12 text-3xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  className = "",
  children,
  type = "button",
  ...rest
}) {
  const display = size === "xl" ? "font-display font-extrabold uppercase tracking-wider" : "font-semibold";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`relative inline-flex select-none items-center justify-center gap-2 rounded-xl outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${display} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
