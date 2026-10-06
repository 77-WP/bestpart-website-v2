export function Brand({ size = 36 }: { size?: number }) {
  const w = Math.round(size * (1920 / 1080));
  return (
    <img
      src="/brand/logo.png"
      alt="Best Part"
      width={w}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
