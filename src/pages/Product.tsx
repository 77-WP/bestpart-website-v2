import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MENU_ITEMS, SIZES, SPICE_LEVELS, ADDONS } from '../data/menu';
import { Bowl } from '../components/Bowl';
import { useCart, type CartItem } from '../store/cart';
import { I } from '../components/icons';

export default function Product() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();

  const item = MENU_ITEMS.find(i => i.id === itemId);
  const [sizeIdx, setSizeIdx]   = useState(1);       // default Large
  const [spiceIdx, setSpiceIdx] = useState(2);       // default เผ็ดกลาง
  const [addons, setAddons]     = useState<Set<string>>(new Set(['sauce']));
  const [qty, setQty]           = useState(1);

  if (!item) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>{I.close(40)}</div>
          <div style={{ marginTop: 12 }}>ไม่พบเมนูนี้</div>
        </div>
      </div>
    );
  }

  const size       = SIZES[sizeIdx];
  const spice      = SPICE_LEVELS[spiceIdx];
  const activeAddons = ADDONS.filter(a => addons.has(a.id));
  const addonsPrice  = activeAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice    = (item?.price ?? 0) + size.price + addonsPrice;
  const total        = unitPrice * qty;

  function toggleAddon(id: string) {
    setAddons(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const cartItem: CartItem = {
      cartId:     `${item!.id}-${Date.now()}`,
      itemId:     item!.id,
      name:       item!.name,
      nameEn:     item!.nameEn,
      tone:       item!.tone,
      topping:    item!.topping,
      basePrice:  item!.price,
      sizeLabel:  size.label,
      sizePrice:  size.price,
      spice:      spice.label,
      addons:     activeAddons.map(a => ({ label: a.label, price: a.price })),
      qty,
    };
    add(cartItem);
    navigate('/order');
  }

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      {/* Hero */}
      <div style={{
        position: 'relative', height: 300, background: 'var(--bg-3)',
        display: 'grid', placeItems: 'center', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at center, var(--bg-3) 0%, var(--bg) 100%)',
        }} />
        <Bowl tone={item.tone} topping={item.topping} size={240} />
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', left: 14, top: 14,
            width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)',
            border: '1px solid var(--line)', display: 'grid', placeItems: 'center',
          }}
        >{I.close(18)}</button>
        <button style={{
          position: 'absolute', right: 14, top: 14,
          width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)',
          border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
        }}>{I.heart(16)}</button>
      </div>

      {/* Content */}
      <div style={{ padding: '22px 20px 0' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {item.tag && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
              padding: '3px 7px', borderRadius: 3,
              background: item.tag === 'HOT' ? 'var(--accent)' : item.tag === 'NEW' ? 'var(--accent-2)' : 'var(--ink)',
              color: '#fff',
            }}>{item.tag === 'BEST' ? 'BEST SELLER' : item.tag}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: 'var(--gold)' }}>{I.star(11)}</span> 4.9 (1,284)
          </span>
        </div>

        <div className="h-display-th" style={{ fontSize: 26, lineHeight: 1.15 }}>{item.name}</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 14, marginTop: 4 }}>
          {item.nameEn}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.6 }}>{item.desc}</div>

        {/* Size */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="kicker muted">ขนาด · SIZE</div>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>จำเป็น · Required</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            {SIZES.map((s, i) => (
              <button
                key={i}
                onClick={() => setSizeIdx(i)}
                style={{
                  padding: '12px 10px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                  border: i === sizeIdx ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: i === sizeIdx ? 'var(--bg-2)' : 'var(--bg)',
                  position: 'relative',
                }}
              >
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>{s.label}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 1 }}>{s.labelEn}</div>
                <div className="thb" style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>
                  {s.price === 0 ? item.price : item.price + s.price}
                </div>
                {i === sizeIdx && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 14, height: 14, borderRadius: '50%', background: 'var(--ink)',
                    display: 'grid', placeItems: 'center', color: 'var(--bg)',
                  }}>{I.check(10)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Spice */}
        <div style={{ marginTop: 20 }}>
          <div className="kicker muted">ระดับความเผ็ด · SPICE</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {SPICE_LEVELS.map((s, i) => (
              <button
                key={i}
                onClick={() => setSpiceIdx(i)}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--r-pill)',
                  border: i === spiceIdx ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: i === spiceIdx ? 'rgba(181,81,30,0.08)' : 'var(--bg)',
                  color: i === spiceIdx ? 'var(--accent)' : 'var(--ink-2)',
                  fontSize: 12, fontFamily: 'var(--serif)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                {s.label}
                {Array.from({ length: s.flames }).map((_, j) => (
                  <span key={j} style={{ color: 'var(--accent)' }}>{I.flame(9)}</span>
                ))}
              </button>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="kicker muted">เพิ่มเติม · ADD-ONS</div>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>เลือกได้</span>
          </div>
          {ADDONS.map(a => (
            <label
              key={a.id}
              onClick={() => toggleAddon(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: '1px solid var(--line)', cursor: 'pointer',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 6,
                border: addons.has(a.id) ? '0' : '1.5px solid var(--line-2)',
                background: addons.has(a.id) ? 'var(--ink)' : 'transparent',
                color: 'var(--bg)', display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                {addons.has(a.id) && I.check(12)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13 }}>{a.label}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{a.labelEn}</div>
              </div>
              <span className="thb" style={{ fontSize: 13, color: a.price === 0 ? 'var(--accent-2)' : 'var(--ink)' }}>
                {a.price === 0 ? 'ฟรี' : `+${a.price}`}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Sticky add bar */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, width: '100%', maxWidth: 480,
        padding: '14px 18px 26px',
        background: 'var(--bg)', borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 30,
      }}>
        {/* Qty stepper */}
        <div style={{
          display: 'flex', alignItems: 'center',
          border: '1px solid var(--line)', borderRadius: 'var(--r-pill)',
          background: 'var(--bg-2)',
        }}>
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            style={{ width: 36, height: 36, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}
          >{I.minus(16)}</button>
          <span style={{ minWidth: 24, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 16 }}>{qty}</span>
          <button
            onClick={() => setQty(q => q + 1)}
            style={{ width: 36, height: 36, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
          >{I.plus(16)}</button>
        </div>

        <button
          onClick={handleAdd}
          style={{
            flex: 1, background: 'var(--ink)', color: 'var(--on-accent)',
            border: 0, padding: '14px 18px', borderRadius: 'var(--r-pill)',
            fontWeight: 600, fontSize: 13, letterSpacing: '.04em',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>เพิ่มลงตะกร้า</span>
          <span className="thb" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{total}</span>
        </button>
      </div>
    </div>
  );
}
