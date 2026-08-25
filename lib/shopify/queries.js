export const SHOP_QUERY = `
  query ShopInfo {
    shop {
      id
      name
      email
      myshopifyDomain
      ianaTimezone
      currencyCode
      billingAddress { countryCodeV2 }
    }
  }
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        status
        vendor
        productType
        totalInventory
        publishedAt
        featuredImage { url }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            price
            compareAtPrice
            inventoryQuantity
            inventoryPolicy
            availableForSale
            inventoryItem { id tracked unitCost { amount } }
          }
        }
      }
    }
  }
`;

export const PRODUCT_QUERY = `
  query Product($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      vendor
      productType
      totalInventory
      publishedAt
      featuredImage { url }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          inventoryQuantity
          inventoryPolicy
          availableForSale
          inventoryItem { id tracked unitCost { amount } }
        }
      }
    }
  }
`;

export const ORDERS_QUERY = `
  query Orders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        processedAt
        createdAt
        cancelledAt
        displayFinancialStatus
        displayFulfillmentStatus
        paymentGatewayNames
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentSubtotalPriceSet { shopMoney { amount } }
        totalRefundedSet { shopMoney { amount } }
        currentTotalDiscountsSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        discountApplications(first: 10) {
          nodes { ... on DiscountCodeApplication { code } }
        }
        shippingAddress { countryCodeV2 provinceCode }
        customer { id firstName lastName email numberOfOrders }
        lineItems(first: 50) {
          nodes {
            title
            quantity
            originalUnitPriceSet { shopMoney { amount } }
            product { id }
            variant { id }
          }
        }
        fulfillments(first: 1) { createdAt }
      }
    }
  }
`;

export const ORDER_QUERY = `
  query Order($id: ID!) {
    order(id: $id) {
      id
      name
      processedAt
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      paymentGatewayNames
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      currentSubtotalPriceSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      currentTotalDiscountsSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      discountApplications(first: 10) {
        nodes { ... on DiscountCodeApplication { code } }
      }
      shippingAddress { countryCodeV2 provinceCode }
      customer { id firstName lastName email numberOfOrders }
      lineItems(first: 50) {
        nodes {
          title
          quantity
          originalUnitPriceSet { shopMoney { amount } }
          product { id }
          variant { id }
        }
      }
      fulfillments(first: 1) { createdAt }
    }
  }
`;

export const INVENTORY_ITEM_QUERY = `
  query InventoryItem($id: ID!) {
    inventoryItem(id: $id) {
      id
      tracked
      variant {
        id
        title
        sku
        inventoryQuantity
        inventoryPolicy
        product { id title status publishedAt featuredImage { url } }
      }
    }
  }
`;

export const CUSTOMERS_QUERY = `
  query Customers($first: Int!, $after: String, $query: String) {
    customers(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes { id email firstName lastName numberOfOrders createdAt }
    }
  }
`;

export const WEBHOOK_SUBSCRIPTION_MUTATION = `
  mutation WebhookCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

export const WEBHOOKS_QUERY = `
  query Webhooks($first: Int!) {
    webhookSubscriptions(first: $first) {
      nodes { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } }
    }
  }
`;
