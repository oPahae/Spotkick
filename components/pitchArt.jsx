export default function PitchArt({ className = "" }) {
  return (
    <svg viewBox="0 0 800 520" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <rect x="20" y="20" width="760" height="520" />
      <rect x="170" y="20" width="460" height="190" />
      <rect x="290" y="20" width="220" height="70" />
      <path d="M326 210a95 95 0 0 0 148 0" />
      <circle cx="400" cy="160" r="4" fill="currentColor" />
      <rect x="352" y="4" width="96" height="16" strokeWidth="4" />
    </svg>
  );
}
