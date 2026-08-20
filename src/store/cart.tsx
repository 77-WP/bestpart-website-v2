import { createContext, useContext, useReducer, type ReactNode } from 'react';

export type CartItem = {
  cartId: string;       // unique per cart line
  itemId: string;
  name: string;
  nameEn: string;
  tone: string;
  topping: string;
  basePrice: number;
  sizeLabel: string;
  sizePrice: number;
  spice: string;
  addons: { label: string; price: number }[];
  qty: number;
};

export function itemTotal(it: CartItem) {
  const addonsTotal = it.addons.reduce((s, a) => s + a.price, 0);
  return (it.basePrice + it.sizePrice + addonsTotal) * it.qty;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, it) => s + itemTotal(it), 0);
}

type Action =
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; cartId: string }
  | { type: 'SET_QTY'; cartId: string; qty: number }
  | { type: 'CLEAR' };

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'ADD':    return [...state, action.item];
    case 'REMOVE': return state.filter(i => i.cartId !== action.cartId);
    case 'SET_QTY':
      return state.map(i => i.cartId === action.cartId ? { ...i, qty: Math.max(1, action.qty) } : i);
    case 'CLEAR':  return [];
    default:       return state;
  }
}

const CartCtx = createContext<{
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (cartId: string) => void;
  setQty: (cartId: string, qty: number) => void;
  clear: () => void;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  return (
    <CartCtx.Provider value={{
      items,
      add:    (item) => dispatch({ type: 'ADD', item }),
      remove: (cartId) => dispatch({ type: 'REMOVE', cartId }),
      setQty: (cartId, qty) => dispatch({ type: 'SET_QTY', cartId, qty }),
      clear:  () => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
