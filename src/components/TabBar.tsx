import { useNavigate } from 'react-router-dom';
import { I } from './icons';

const TABS = [
  { id: 'home',   icon: (s: number) => I.home(s),    label: 'หน้าแรก', path: '/' },
  { id: 'menu',   icon: (s: number) => I.search(s),  label: 'เมนู',    path: '/order' },
  { id: 'orders', icon: (s: number) => I.receipt(s), label: 'ออเดอร์', path: '/track' },
  { id: 'me',     icon: (s: number) => I.user(s),    label: 'บัญชี',   path: '/me' },
];

export function TabBar({ active }: { active: 'home' | 'menu' | 'orders' | 'me' }) {
  const navigate = useNavigate();
  return (
    <div className="tabbar">
      {TABS.map(t => (
        <button
          key={t.id}
          className={'tab' + (active === t.id ? ' active' : '')}
          onClick={() => navigate(t.path)}
        >
          {t.icon(20)}
          <div className="tab-dot" />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
