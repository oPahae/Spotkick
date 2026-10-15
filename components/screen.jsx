import PitchArt from "./pitchArt";

export default function Screen({ children, className = "", art = true }) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-ink-950 ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(255,226,140,0.22),transparent_60%),radial-gradient(ellipse_60%_50%_at_90%_100%,rgba(47,191,113,0.16),transparent_60%),linear-gradient(180deg,#06130e_0%,#050d0a_100%)]" />
      {art ? <PitchArt className="pointer-events-none absolute -bottom-16 left-1/2 h-[120%] w-[160%] -translate-x-1/2 text-chalk opacity-[0.045] md:w-[110%]" /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
