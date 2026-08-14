import prisma from '@/lib/prisma';
import { runAlertScan } from '@/lib/alerts/scan';
import { backfillMetrics } from '@/lib/metrics';

export const DEMO_SHOP_DOMAIN = 'storepulse-demo.myshopify.com';

const ADJECTIVES = ['Classic', 'Premium', 'Everyday', 'Studio', 'Heritage', 'Urban', 'Coastal', 'Alpine', 'Nordic', 'Vintage'];
const NOUNS = ['Hoodie', 'Tee', 'Jacket', 'Sneaker', 'Cap', 'Backpack', 'Mug', 'Bottle', 'Notebook', 'Lamp'];
const SIZES = ['Small', 'Medium', 'Large', 'X-Large', 'XX-Large'];
const VENDORS = ['Northwind', 'Aster & Co', 'Bluebird', 'Ridgeline'];
const TYPES = ['Apparel', 'Accessories', 'Home', 'Footwear'];
const FIRST = ['Aria', 'Noah', 'Maya', 'Liam', 'Zoe', 'Kabir', 'Ines', 'Theo', 'Sana', 'Owen'];
const LAST = ['Sharma', 'Patel', 'Nguyen', 'Silva', 'Okafor', 'Kim', 'Rossi', 'Dubois'];

// Deterministic PRNG so demo runs are reproducible.
function makeRandom(seed = 42) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

/**
 * Create (or reset) the demo store. Demo data lives behind `isDemo` so it can
 * never be confused with, or merged into, a real merchant's store.
 */
export async function seedDemoStore({ reset = true } = {}) {
  const rand = makeRandom(20260814);

  let store = await prisma.store.findUnique({ where: { shopDomain: DEMO_SHOP_DOMAIN } });

  if (store && reset) {
    await prisma.store.delete({ where: { id: store.id } });
    store = null;
  }

  if (!store) {
    store = await prisma.store.create({
      data: {
        shopDomain: DEMO_SHOP_DOMAIN,
        shopName: 'StorePulse Demo Store',
        accessToken: 'demo-token-not-usable',
        email: 'demo@storepulse.app',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        isDemo: true,
        onboardedAt: new Date(),
        lastSyncAt: new Date(),
      },
    });
  }

  await prisma.alertSetting.upsert({
    where: { shopId: store.id },
    create: { shopId: store.id },
    update: {},
  });
  await prisma.notificationPreference.upsert({
    where: { shopId: store.id },
    create: { shopId: store.id, notifyEmail: store.email, emailEnabled: false },
    update: { emailEnabled: false },
  });

  // ---- Products: 100 products / ~500 variants -----------------------------
  const products = [];
  for (let i = 0; i < 100; i += 1) {
    const title = `${pick(rand, ADJECTIVES)} ${pick(rand, NOUNS)} ${i + 1}`;
    const product = await prisma.product.create({
      data: {
        shopId: store.id,
        shopifyProductId: String(7000000000 + i),
        title,
        handle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'ACTIVE',
        vendor: pick(rand, VENDORS),
        productType: pick(rand, TYPES),
        publishedOnline: true,
        imageUrl: null,
        totalInventory: 0,
      },
    });

    let total = 0;
    for (let v = 0; v < 5; v += 1) {
      // Scripted edge cases the acceptance test looks for.
      let quantity = 15 + Math.floor(rand() * 120);
      if (i === 0 && v === 1) quantity = 0; // 1 unexpectedly sold-out variant
      if (i === 1 && v === 0) quantity = 7; // low stock
      if (i === 2 && v === 0) quantity = 4; // low stock

      const price = 499 + Math.floor(rand() * 4000);
      total += quantity;

      await prisma.productVariant.create({
        data: {
          productId: product.id,
          shopifyVariantId: String(8000000000 + i * 5 + v),
          title: SIZES[v],
          sku: `SKU-${i + 1}-${v + 1}`,
          price,
          compareAtPrice: rand() > 0.7 ? price + 500 : null,
          inventoryItemId: String(9000000000 + i * 5 + v),
          inventoryQuantity: quantity,
          previousQuantity: i === 0 && v === 1 ? 8 : quantity,
          inventoryPolicy: 'DENY',
          inventoryTracked: true,
          availableForSale: quantity > 0,
        },
      });
    }

    await prisma.product.update({ where: { id: product.id }, data: { totalInventory: total } });
    products.push(product);
  }

  const variants = await prisma.productVariant.findMany({
    where: { product: { shopId: store.id } },
    include: { product: true },
  });

  // ---- Orders: 50 orders across the last 45 days --------------------------
  const customers = Array.from({ length: 18 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    return { name: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com` };
  });

  for (let i = 0; i < 50; i += 1) {
    const customer = pick(rand, customers);
    const ageHours = i < 3 ? 26 + i * 14 : Math.floor(rand() * 45 * 24) + 3;
    const processedAt = new Date(Date.now() - ageHours * 3600 * 1000);

    // The first three orders are deliberately old and unfulfilled.
    const delayed = i < 3;
    const fulfilled = !delayed && rand() > 0.25;
    const refunded = !delayed && rand() > 0.88;

    const itemCount = 1 + Math.floor(rand() * 3);
    const lineItems = [];
    let total = 0;
    for (let li = 0; li < itemCount; li += 1) {
      const variant = pick(rand, variants);
      const quantity = 1 + Math.floor(rand() * 2);
      const price = Number(variant.price);
      total += price * quantity;
      lineItems.push({
        shopifyProductId: variant.product.shopifyProductId,
        shopifyVariantId: variant.shopifyVariantId,
        title: `${variant.product.title} — ${variant.title}`,
        quantity,
        price,
      });
    }

    const order = await prisma.order.create({
      data: {
        shopId: store.id,
        shopifyOrderId: String(5500000000 + i),
        orderNumber: `#${10450 + i}`,
        customerName: customer.name,
        customerEmail: customer.email,
        totalPrice: total,
        subtotalPrice: total,
        refundedAmount: refunded ? Math.round(total * 0.5) : 0,
        currency: store.currency,
        financialStatus: refunded ? 'PARTIALLY_REFUNDED' : 'PAID',
        fulfillmentStatus: fulfilled ? 'FULFILLED' : 'UNFULFILLED',
        paymentGateway: rand() > 0.6 ? 'Cash on Delivery' : 'shopify_payments',
        isCOD: rand() > 0.6,
        lineItemCount: lineItems.length,
        processedAt,
        fulfilledAt: fulfilled ? new Date(processedAt.getTime() + 6 * 3600 * 1000) : null,
      },
    });

    await prisma.orderLineItem.createMany({
      data: lineItems.map((li) => ({ ...li, orderId: order.id })),
    });
  }

  await backfillMetrics(store, { days: 45 });
  const scan = await runAlertScan(store, { notify: false });

  return { store, scan, products: products.length, variants: variants.length };
}

export async function getDemoStore() {
  return prisma.store.findUnique({
    where: { shopDomain: DEMO_SHOP_DOMAIN },
    include: { settings: true, preference: true },
  });
}
