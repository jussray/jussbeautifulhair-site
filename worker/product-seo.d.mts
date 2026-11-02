export type SeoLiveProduct = {
  id: string; vendor?: string; availableForSale?: boolean;
  variants?: Array<{price:number; currencyCode?:string; availableForSale:boolean}>;
};
export declare const APPROVED_SEO_PRODUCTS: Readonly<Record<string,{name:string;description:string}>>;
export declare function renderProductSeoHtml(html:string,handle:string,liveProduct:SeoLiveProduct|null): {html:string;indexable:boolean}|null;
