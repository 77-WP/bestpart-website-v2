import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './store/cart';
import Landing  from './pages/Landing';
import Order    from './pages/Order';
import Product  from './pages/Product';
import Cart     from './pages/Cart';
import Checkout from './pages/Checkout';
import Track    from './pages/Track';
import Me       from './pages/Me';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/"               element={<Landing />} />
          <Route path="/order"          element={<Order />} />
          <Route path="/order/:itemId"  element={<Product />} />
          <Route path="/cart"           element={<Cart />} />
          <Route path="/checkout"       element={<Checkout />} />
          <Route path="/track"          element={<Track />} />
          <Route path="/track/:orderId" element={<Track />} />
          <Route path="/me"             element={<Me />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
