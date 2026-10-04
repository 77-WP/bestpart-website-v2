import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './store/cart';
import { LangProvider } from './store/lang';
import { TEST_MODE } from './config/env';
import Landing  from './pages/Landing';
import Order    from './pages/Order';
import Product  from './pages/Product';
import Cart     from './pages/Cart';
import Checkout from './pages/Checkout';
import Track    from './pages/Track';
import Orders   from './pages/Orders';
import Pay      from './pages/Pay';

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <CartProvider>
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
        </Routes>
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
    </BrowserRouter>
  );
}
