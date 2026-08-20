const toneColors: Record<string, string> = {
  clay:   'rgba(181,81,30,0.22)',
  sage:   'rgba(74,93,63,0.22)',
  wood:   'rgba(120,80,40,0.22)',
  gold:   'rgba(184,134,46,0.22)',
};

export function Bowl({ tone = 'clay', topping = 'egg', size = 72 }: { tone?: string; topping?: string; size?: number }) {
  const color = toneColors[tone] ?? toneColors.clay;
  const darker = color.replace('0.22', '0.12');
  return (
    <div
      data-label={topping}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 100 ? 'var(--r-md)' : 'var(--r-sm)',
        overflow: 'hidden',
        background: `repeating-linear-gradient(135deg, ${color} 0 8px, ${darker} 8px 16px)`,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', inset: 0,
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
        color: 'var(--ink)', opacity: 0.55,
        textTransform: 'uppercase',
      }}>{topping}</span>
    </div>
  );
}
