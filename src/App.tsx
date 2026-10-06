import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './store/cart';
import { LangProvider } from './store/lang';
import { TEST_MODE } from './config/env';
import { initAnalytics } from './lib/analytics';
import { supabaseConfigMissing } from './lib/supabase';
import { useT } from './i18n';
import { HelpLink } from './components/HelpLink';
import Landing  from './pages/Landing';
import Order    from './pages/Order';
import Product  from './pages/Product';
import Cart     from './pages/Cart';
import Checkout from './pages/Checkout';
import Track    from './pages/Track';
import Orders   from './pages/Orders';
import Pay      from './pages/Pay';
import Privacy  from './pages/Privacy';
import { PrivacyBanner } from './components/PrivacyBanner';

function AppInner() {
  const { t } = useT();

  useEffect(() => {
    if (!supabaseConfigMissing) initAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (supabaseConfigMissing) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)' }}>
          {t('app.configError')}
        </div>
        <HelpLink />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/"               element={<Landing />} />
        <Route path="/order"          element={<Order />} />
        <Route path="/order/:itemId"  element={<Product />} />
        <Route path="/cart"           element={<Cart />} />
        <Route path="/checkout"       element={<Checkout />} />
        <Route path="/pay/:orderId"   element={<Pay />} />
        <Route path="/track"          element={<Track />} />
        <Route path="/track/:orderId" element={<Track />} />
        <Route path="/orders"         element={<Orders />} />
        <Route path="/me"             element={<Navigate to="/orders" replace />} />
        <Route path="/privacy"        element={<Privacy />} />
      </Routes>
      <PrivacyBanner />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <CartProvider>
        <AppInner />
      </CartProvider>
      </LangProvider>
      {TEST_MODE && (
        <div style={{
          position: 'fixed', bottom: 60, right: 12, zIndex: 9999,
          background: '#b45309', color: '#fffdf8',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
          padding: '3px 8px', borderRadius: 4, pointerEvents: 'none',
        }}>
          TEST MODE
        </div>
      )}
      {import.meta.env.VITE_VERCEL_ENV === 'preview' &&
       import.meta.env.VITE_PREVIEW_OPEN === 'true' && (
        <div style={{
          position: 'fixed', bottom: 60, left: 12, zIndex: 9998,
          background: '#1a5aff', color: '#fff',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
          padding: '3px 8px', borderRadius: 4, pointerEvents: 'none',
        }}>
          PREVIEW
        </div>
      )}
    </BrowserRouter>
  );
}
