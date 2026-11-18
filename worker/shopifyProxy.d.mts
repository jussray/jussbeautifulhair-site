export declare const SHOPIFY_PROXY_HOST: "8qp1z2-az.myshopify.com";
export declare const SHOPIFY_PROXY_ORIGIN: `https://${typeof SHOPIFY_PROXY_HOST}`;
export declare const SHOPIFY_PROXY_PATH_PREFIXES: readonly string[];
export declare function isShopifyProxyPath(pathname: string): boolean;
export declare function rewriteProxyRedirectLocation(
  location: string,
  requestOrigin: string,
): string;
export declare function proxyToShopify(request: Request): Promise<Response>;
