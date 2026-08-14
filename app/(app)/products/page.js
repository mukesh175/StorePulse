import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getCurrentStore } from '@/lib/shopify/session';
import { getTopProducts } from '@/lib/reports';
import { PageHeader, EmptyState, Card } from '@/components/ui/Primitives';
import { formatMoney, formatNumber } from '@/lib/utils/format';
import { productAdminUrl } from '@/lib/shopify/urls';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function ProductsPage({ searchParams }) {
  const store = await getCurrentStore();
  if (!store) redirect('/');

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page ?? '1', 10) || 1);

  const where = { shopId: store.id };

  const [products, total, topProducts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { title: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { variants: { select: { inventoryQuantity: true, price: true } } },
    }),
    prisma.product.count({ where }),
    page === 1 ? getTopProducts(store, { days: 30, limit: 5 }) : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="sp-fade-in">
      <PageHeader title="Products" subtitle={`${total} product${total === 1 ? '' : 's'} synced from Shopify`} />

      {topProducts.length > 0 && (
        <Card className="mb-3">
          <div className="sp-card-title mb-1">Best sellers</div>
          <div className="sp-card-sub mb-3">Units sold in the last 30 days</div>
          <div className="row g-2">
            {topProducts.map((product) => (
              <div className="col-12 col-md-6 col-xl-4" key={product.shopifyProductId}>
                <div className="d-flex align-items-center gap-2">
                  <span className="sp-thumb" aria-hidden="true">
                    📦
                  </span>
                  <div className="min-w-0">
                    <div className="text-truncate" style={{ fontSize: 14, fontWeight: 560 }}>
                      {product.title}
                    </div>
                    <div className="sp-card-sub">
                      {formatNumber(product.units)} units · {formatMoney(product.revenue, store.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {products.length === 0 ? (
        <EmptyState
          emoji="📦"
          title="No products synced yet"
          text="Run a sync to pull your catalogue from Shopify. StorePulse then watches every variant for inventory problems."
        />
      ) : (
        <div className="sp-card">
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>Variants</th>
                  <th>Inventory</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const soldOut = product.totalInventory <= 0;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="sp-thumb" aria-hidden="true">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.imageUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }}
                              />
                            ) : (
                              '📦'
                            )}
                          </span>
                          <strong>{product.title}</strong>
                        </div>
                      </td>
                      <td>{product.vendor || '—'}</td>
                      <td>{product.productType || '—'}</td>
                      <td className="sp-num">{product.variants.length}</td>
                      <td className="sp-num">{formatNumber(product.totalInventory)}</td>
                      <td>
                        <span className={`sp-pill ${soldOut ? 'critical' : product.status === 'ACTIVE' ? 'success' : 'neutral'}`}>
                          {soldOut ? 'SOLD OUT' : product.status}
                        </span>
                      </td>
                      <td>
                        <a
                          className="sp-btn sp-btn-sm"
                          href={productAdminUrl(store.shopDomain, product.shopifyProductId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View product
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="d-flex align-items-center justify-content-between mt-3">
          <span className="sp-card-sub">
            Page {page} of {pages}
          </span>
          <div className="d-flex gap-2">
            {page > 1 && (
              <Link className="sp-btn sp-btn-sm" href={`/products?page=${page - 1}`}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="sp-btn sp-btn-sm" href={`/products?page=${page + 1}`}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
