import { createContext, useContext, useReducer, type ReactNode } from 'react';

export type CartItem = {
  cartId: string;       // unique per cart line
  itemId: string;
  name: string;
  nameEn: string;
  tone: string;
  topping: string;
  imageUrl?: string;    // menu_items.image_url — optional, used for Cart display
  basePrice: number;
  sizeLabel: string;
  sizePrice: number;
  spice: string;
  addons: { label: string; price: number }[];
  qty: number;
  isDrink?: boolean;    // true for items added from the drinks rail
};

/** Cutlery / condiments defaults — change here to update behaviour. */
export const CUTLERY_DEFAULT    = false;
export const CONDIMENTS_DEFAULT = false;

export function itemTotal(it: CartItem) {
  const addonsTotal = it.addons.reduce((s, a) => s + a.price, 0);
  return (it.basePrice + it.sizePrice + addonsTotal) * it.qty;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, it) => s + itemTotal(it), 0);
}

type CartState = {
  items: CartItem[];
  cutlery: boolean;
  condiments: boolean;
};

type Action =
  | { type: 'ADD'; item: CartItem }
  | { type: 'REPLACE'; cartId: string; item: CartItem }
  | { type: 'REMOVE'; cartId: string }
  | { type: 'SET_QTY'; cartId: string; qty: number }
  | { type: 'CLEAR' }
  | { type: 'SET_CUTLERY'; value: boolean }
  | { type: 'SET_CONDIMENTS'; value: boolean };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'ADD':
      return { ...state, items: [...state.items, action.item] };
    case 'REPLACE':
      return {
        ...state,
        items: state.items.map(i => i.cartId === action.cartId ? action.item : i),
      };
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.cartId !== action.cartId) };
    case 'SET_QTY':
      return {
        ...state,
        items: state.items.map(i =>
          i.cartId === action.cartId ? { ...i, qty: Math.max(1, action.qty) } : i,
        ),
      };
    case 'CLEAR':
      return { ...state, items: [] };
    case 'SET_CUTLERY':
      return { ...state, cutlery: action.value };
    case 'SET_CONDIMENTS':
      return { ...state, condiments: action.value };
    default:
      return state;
  }
}

const CartCtx = createContext<{
  items: CartItem[];
  cutlery: boolean;
  condiments: boolean;
  add: (item: CartItem) => void;
  replace: (cartId: string, item: CartItem) => void;
  remove: (cartId: string) => void;
  setQty: (cartId: string, qty: number) => void;
  clear: () => void;
  setCutlery: (v: boolean) => void;
  setCondiments: (v: boolean) => void;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items:      [],
    cutlery:    CUTLERY_DEFAULT,
    condiments: CONDIMENTS_DEFAULT,
  });
  return (
    <CartCtx.Provider value={{
      items:        state.items,
      cutlery:      state.cutlery,
      condiments:   state.condiments,
      add:          (item)        => dispatch({ type: 'ADD', item }),
      replace:      (cartId, item) => dispatch({ type: 'REPLACE', cartId, item }),
      remove:       (cartId)      => dispatch({ type: 'REMOVE', cartId }),
      setQty:       (cartId, qty) => dispatch({ type: 'SET_QTY', cartId, qty }),
      clear:        ()            => dispatch({ type: 'CLEAR' }),
      setCutlery:   (value)       => dispatch({ type: 'SET_CUTLERY', value }),
      setCondiments:(value)       => dispatch({ type: 'SET_CONDIMENTS', value }),
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
