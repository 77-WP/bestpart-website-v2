import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Order from './pages/Order';
import Track from './pages/Track';
import Me from './pages/Me';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/order" element={<Order />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:orderId" element={<Track />} />
        <Route path="/me" element={<Me />} />
      </Routes>
    </BrowserRouter>
  );
}
