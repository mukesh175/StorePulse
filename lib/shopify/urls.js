export function storeHandle(shopDomain) {
  return String(shopDomain || '').replace('.myshopify.com', '');
}

export function adminUrl(shopDomain, path) {
  return `https://admin.shopify.com/store/${storeHandle(shopDomain)}${path}`;
}

export const productAdminUrl = (shopDomain, productId) => adminUrl(shopDomain, `/products/${productId}`);
export const variantAdminUrl = (shopDomain, productId, variantId) =>
  adminUrl(shopDomain, `/products/${productId}/variants/${variantId}`);
export const orderAdminUrl = (shopDomain, orderId) => adminUrl(shopDomain, `/orders/${orderId}`);
export const inventoryAdminUrl = (shopDomain) => adminUrl(shopDomain, '/products/inventory');
