import prisma from '@/lib/prisma';

/**
 * Cost assumptions the merchant supplies, because Shopify cannot know them.
 * Everything derived from these is labelled as an estimate in the UI.
 */
export async function getCostSettings(store) {
  const existing = await prisma.costSetting.findUnique({ where: { shopId: store.id } });
  if (existing) return existing;
  return prisma.costSetting.create({ data: { shopId: store.id } });
}

export function asNumbers(costSettings) {
  return {
    shippingCostPerOrder: Number(costSettings.shippingCostPerOrder),
    paymentFeePercent: Number(costSettings.paymentFeePercent),
    codRtoPercent: Number(costSettings.codRtoPercent),
    codRtoCostPerOrder: Number(costSettings.codRtoCostPerOrder),
    monthlyAdSpend: Number(costSettings.monthlyAdSpend),
    freeShippingThreshold: Number(costSettings.freeShippingThreshold),
    defaultMarginPercent:
      costSettings.defaultMarginPercent === null ? null : Number(costSettings.defaultMarginPercent),
  };
}

/**
 * How complete the cost data is. Profit numbers are only as trustworthy as
 * this, so the UI shows it prominently rather than burying it.
 */
export async function getCostCoverage(store) {
  const [total, withCost] = await Promise.all([
    prisma.productVariant.count({ where: { product: { shopId: store.id } } }),
    prisma.productVariant.count({ where: { product: { shopId: store.id }, unitCost: { not: null } } }),
  ]);

  return {
    totalVariants: total,
    withCost,
    percent: total ? (withCost / total) * 100 : 0,
    complete: total > 0 && withCost === total,
  };
}
