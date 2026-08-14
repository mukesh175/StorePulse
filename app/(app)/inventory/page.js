import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentStore } from '@/lib/shopify/session';
import { getAlertSettings } from '@/lib/alerts/scan';
import { PageHeader, EmptyState, MetricCard, Section } from '@/components/ui/Primitives';
import { formatMoney, formatNumber } from '@/lib/utils/format';
import { productAdminUrl } from '@/lib/shopify/urls';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const settings = await getAlertSettings(store);

  const variants = await prisma.productVariant.findMany({
    where: {
      inventoryTracked: true,
      inventoryQuantity: { lte: settings.lowStockThreshold },
      product: { shopId: store.id, status: 'ACTIVE' },
    },
    include: { product: true },
    orderBy: { inventoryQuantity: 'asc' },
    take: 200,
  });

  const soldOut = variants.filter((v) => v.inventoryQuantity <= 0);
  const low = variants.filter((v) => v.inventoryQuantity > 0);
  const valueAtRisk = soldOut.reduce((sum, v) => sum + Number(v.price) * Math.max(1, v.previousQuantity), 0);

  return (
    <div className="sp-fade-in">
      <PageHeader
        title="Inventory"
        subtitle={`Watching every tracked variant against your ${settings.lowStockThreshold}-unit low-stock threshold`}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-4">
          <MetricCard label="Sold out" value={formatNumber(soldOut.length)} footnote="variants" />
        </div>
        <div className="col-6 col-lg-4">
          <MetricCard label="Low stock" value={formatNumber(low.length)} footnote={`≤ ${settings.lowStockThreshold} units`} />
        </div>
        <div className="col-12 col-lg-4">
          <MetricCard
            label="Value at risk"
            value={formatMoney(valueAtRisk, store.currency)}
            footnote="sold-out stock at last known depth"
          />
        </div>
      </div>

      <Section title="Needs restocking" sub="Sorted by urgency — sold out first">
        {variants.length === 0 ? (
          <EmptyState
            title="Inventory is healthy"
            text={`No tracked variant is at or below ${settings.lowStockThreshold} units. We'll alert you the moment that changes.`}
          />
        ) : (
          <div className="sp-card">
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>SKU</th>
                    <th>Available</th>
                    <th>Previously</th>
                    <th>Policy</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <td>
                        <strong>{variant.product.title}</strong>
                      </td>
                      <td>{variant.title || 'Default'}</td>
                      <td className="sp-card-sub">{variant.sku || '—'}</td>
                      <td>
                        <span className={`sp-pill ${variant.inventoryQuantity <= 0 ? 'critical' : 'warning'}`}>
                          {variant.inventoryQuantity} units
                        </span>
                      </td>
                      <td className="sp-num sp-card-sub">{variant.previousQuantity}</td>
                      <td className="sp-card-sub">{variant.inventoryPolicy}</td>
                      <td>
                        <a
                          className="sp-btn sp-btn-sm"
                          href={productAdminUrl(store.shopDomain, variant.product.shopifyProductId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Restock
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
