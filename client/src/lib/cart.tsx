import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import type { ReactNode } from "react";

export interface CartItem {
  id: string;
  variantId: string;
  name: string;
  variant: string;
  price: number;
  qty: number;
  image: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const STORAGE_KEY = "jbh_cart_v2";

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.id === "string" &&
    typeof item.variantId === "string" &&
    /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(item.variantId) &&
    typeof item.name === "string" &&
    typeof item.variant === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    typeof item.qty === "number" &&
    Number.isInteger(item.qty) &&
    item.qty > 0 &&
    item.qty <= 10 &&
    typeof item.image === "string"
  );
}

function readStorage(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredCartItem) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // sessionStorage unavailable (private mode, iframe restrictions) — degrade gracefully
  }
}

function clearStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStorage());

  useEffect(() => {
    writeStorage(items);
  }, [items]);

  const addItem = useCallback(
    (item: Omit<CartItem, "qty">, qty: number = 1) => {
      setItems((prev) => {
        const idx = prev.findIndex((candidate) => candidate.variantId === item.variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            qty: Math.min(10, next[idx].qty + qty),
            price: item.price,
            name: item.name,
            variant: item.variant,
            image: item.image,
          };
          return next;
        }
        return [...prev, { ...item, qty: Math.min(10, Math.max(1, qty)) }];
      });
    },
    [],
  );

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const updateQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId
          ? { ...item, qty: Math.min(10, Math.max(1, qty)) }
          : item,
      ),
    );
  }, []);

  const clear = useCallback(() => {
    clearStorage();
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    return {
      items,
      addItem,
      removeItem,
      updateQty,
      clear,
      count,
      subtotal,
    };
  }, [items, addItem, removeItem, updateQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
