export function Brand({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <path
        d="M20 33S6 24.5 6 15.2A7.2 7.2 0 0 1 20 11.5a7.2 7.2 0 0 1 14 3.7C34 24.5 20 33 20 33z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <text x="20" y="21.5" textAnchor="middle" fontFamily="var(--serif)" fontSize="11" fill="var(--accent)">
        BP
      </text>
    </svg>
  );
}
