import type { Product } from "../shared/catalog";
export interface StripeCommerceEnv {
  JBH_STRIPE_COMMERCE_MODE?: string;
  ENABLE_LEGACY_STRIPE_CHECKOUT?: string;
  JBH_STRIPE_ACCOUNT_ID?: string;
  JBH_STRIPE_LIVE_ENABLED?: string;
  JBH_STRIPE_FULFILLMENT_READY?: string;
  JBH_STRIPE_APPROVED_OFFERS?: string;
  STRIPE_SECRET_KEY?: string;
}
export interface FirstPartyVariant {
  id: string;
  option: string;
  price: number;
  availableForSale: boolean;
}
export interface FirstPartyProduct extends Omit<Product, "variants"> {
  shopifyProductId: "jbh:catalog";
  variants: FirstPartyVariant[];
  availableForSale: true;
}
export interface StripeCommerceState {
  mode: "test" | "live";
  catalog: FirstPartyProduct[];
  approved: Set<string>;
}
export function getStripeCommerceState(env: StripeCommerceEnv, products: Product[], requestUrl?: string): StripeCommerceState | null;
