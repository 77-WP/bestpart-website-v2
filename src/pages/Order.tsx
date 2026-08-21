import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bowl } from '../components/Bowl';
import { TabBar } from '../components/TabBar';
import { CartBar } from '../components/CartBar';
import { I } from '../components/icons';

type Category = { id: string; name_th: string; name_en: string; display_order: number };
type MenuItem  = { id: string; name_th: string; name_en: string; base_price: number; image_url: string | null; is_best_seller: boolean };

export default function Order() {
  const navigate = useNavigate();
  const [cats, setCats]           = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Fetch categories once
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name_th, name_en, display_order')
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCats(data as Category[]);
          setActiveCat(data[0].id);
        }
      });
  }, []);

  // Fetch items when active category changes
  useEffect(() => {
    if (!activeCat) return;
    setLoadingItems(true);
    setItems([]);
    supabase
      .from('menu_items')
      .select('id, name_th, name_en, base_price, image_url, is_best_seller')
      .eq('is_active', true)
      .eq('category_id', activeCat)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as MenuItem[]);
        setLoadingItems(false);
      });
  }, [activeCat]);

  const activeCatData = cats.find(c => c.id === activeCat);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)',
        padding: '12px 18px 10px', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}
          >{I.back(22)}</button>
          <div style={{ flex: 1 }}>
            <div className="kicker">เมนู · MENU</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span style={{ color: 'var(--accent-2)' }}>{I.pin(13)}</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>สาขาทองหล่อ</span>
              <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>· 8 นาที</span>
            </div>
          </div>
          <button style={{
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
          }}>{I.search(16)}</button>
        </div>
      </div>

      {/* Body — rail + list */}
      <div style={{ display: 'flex', flex: 1, paddingBottom: 80 }}>

        {/* Category rail */}
        <div style={{ width: 92, flexShrink: 0, background: 'var(--bg-3)', paddingTop: 16 }}>
          {cats.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              style={{
                width: '100%', padding: '14px 8px 14px 14px', position: 'relative',
                background: c.id === activeCat ? 'var(--bg)' : 'transparent',
                border: 0, textAlign: 'left',
              }}
            >
              {c.id === activeCat && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 24, background: 'var(--accent)', borderRadius: '0 3px 3px 0',
                }} />
              )}
              <div style={{
                fontFamily: c.id === activeCat ? 'var(--serif)' : 'var(--sans)',
                fontWeight: c.id === activeCat ? 500 : 600,
                fontSize: c.id === activeCat ? 14 : 12,
                color: c.id === activeCat ? 'var(--ink)' : 'var(--ink-2)',
                lineHeight: 1.2,
              }}>{c.name_th}</div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.04em' }}>{c.name_en}</div>
            </button>
          ))}
        </div>

        {/* Item list */}
        <div style={{ flex: 1, padding: '16px 16px 0' }}>

          {/* Promo glass card */}
          <div className="glass" style={{
            marginBottom: 14, padding: '12px 14px', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: 'var(--gold)' }}>{I.star(16)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 12.5 }}>โปรพิเศษวันนี้</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>ลด 10% เมื่อสั่งครบ ฿200</div>
            </div>
            <span style={{ color: 'var(--ink-2)' }}>{I.arrow(13)}</span>
          </div>

          {/* Section header */}
          {activeCatData && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="h-display-th" style={{ fontSize: 22 }}>{activeCatData.name_th}</div>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
                  {activeCatData.name_en.toUpperCase()} · {items.length} รายการ
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6 }}>เสิร์ฟภายใน 8 นาที</div>
            </>
          )}

          {/* Loading skeleton */}
          {loadingItems && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 68, height: 68, borderRadius: 'var(--r-sm)', background: 'var(--bg-3)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 8, width: '70%' }} />
                <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 4, width: '40%' }} />
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!loadingItems && items.length === 0 && activeCat && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              ยังไม่มีเมนูในหมวดนี้
            </div>
          )}

          {/* Menu rows */}
          {!loadingItems && items.map(it => (
            <div
              key={it.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 0', borderBottom: '1px solid var(--line)',
                position: 'relative', cursor: 'pointer',
              }}
              onClick={() => navigate(`/order/${it.id}`)}
            >
              {/* Thumbnail */}
              <div style={{
                width: 68, height: 68, borderRadius: 'var(--r-sm)',
                background: 'var(--bg-3)', flexShrink: 0, overflow: 'hidden',
                display: 'grid', placeItems: 'center',
              }}>
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.name_th}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Bowl tone="clay" topping="egg" size={62} />
                )}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {it.is_best_seller && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                      padding: '2px 6px', borderRadius: 3,
                      background: 'var(--accent)', color: '#fff',
                    }}>BEST</span>
                    <span style={{ color: 'var(--accent)' }}>{I.flame(11)}</span>
                  </div>
                )}
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.2 }}>{it.name_th}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{it.name_en}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span className="price thb" style={{ fontSize: 16, fontFamily: 'var(--mono)' }}>{it.base_price}</span>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/order/${it.id}`); }}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--ink)', color: 'var(--on-accent)',
                      border: 0, display: 'grid', placeItems: 'center',
                    }}
                  >{I.plus(16)}</button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ height: 40 }} />
        </div>
      </div>

      <CartBar />
      <TabBar active="menu" />
    </div>
  );
}
