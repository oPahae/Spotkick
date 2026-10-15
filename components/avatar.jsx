function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function Avatar({ username = "?", sex = "male", image, size = 48, className = "", ring = false }) {
  const h = hash(username);
  const hueA = h % 360;
  const hueB = (hueA + 40 + (h % 60)) % 360;
  const gid = `av${h}${sex}`;
  const skin = ["#f1c9a5", "#d9a47c", "#b97d56", "#8d5a3b"][(h >>> 3) % 4];
  const hair = ["#1b1410", "#3a2416", "#6b4423", "#c9a24a"][(h >>> 5) % 4];
  const style = { width: size, height: size };
  const frame = `shrink-0 overflow-hidden rounded-full bg-ink-800 ${ring ? "ring-2 ring-flare-500 ring-offset-2 ring-offset-ink-900" : "ring-1 ring-white/15"} ${className}`;
  if (image) {
    return (
      <span className={frame} style={style}>
        <img src={image} alt={`${username} profile`} width={size} height={size} className="h-full w-full object-cover" draggable={false} />
      </span>
    );
  }
  return (
    <span className={frame} style={style} role="img" aria-label={`${username} default avatar`}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hueA} 62% 38%)`} />
            <stop offset="1" stopColor={`hsl(${hueB} 70% 22%)`} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        <path d="M14 100c2-24 16-34 36-34s34 10 36 34z" fill={`hsl(${hueB} 55% 52%)`} />
        {sex === "female" ? (
          <path d="M26 52c-4-26 8-38 24-38s28 12 24 38c-1 10 2 18 5 24-9 0-14-4-16-9-3 4-8 6-13 6s-10-2-13-6c-2 5-7 9-16 9 3-6 6-14 5-24z" fill={hair} />
        ) : (
          <path d="M30 40c0-16 8-26 20-26s20 10 20 26c-6-10-12-13-20-13s-14 3-20 13z" fill={hair} />
        )}
        <ellipse cx="50" cy="46" rx="16" ry="19" fill={skin} />
        {sex === "female" ? (
          <path d="M33 42c4-12 11-16 18-16 8 0 14 5 17 16-6-5-12-7-18-7-6 0-12 2-17 7z" fill={hair} />
        ) : (
          <path d="M34 40c3-10 9-14 16-14s13 4 16 14c-5-4-10-6-16-6s-11 2-16 6z" fill={hair} />
        )}
      </svg>
    </span>
  );
}
