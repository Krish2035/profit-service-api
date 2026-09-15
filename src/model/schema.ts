import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

export const productsTable = sqliteTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const productCostHistoryTable = sqliteTable(
  'product_cost_history',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    cost: real('cost').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_cost_history_lookup').on(table.productId, table.effectiveFrom),
  ]
);

export const ordersTable = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().unique(),
  createdAt: text('created_at').notNull(),
  shippingCost: real('shipping_cost').notNull().default(0),
  totalRevenue: real('total_revenue').notNull(),
  totalCogs: real('total_cogs').notNull(),
  totalProfit: real('total_profit').notNull(),
  processedAt: text('processed_at').default(sql`CURRENT_TIMESTAMP`),
});

export const orderItemsTable = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => ordersTable.orderId, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => productsTable.id),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    sellingPrice: real('selling_price').notNull(),
    unitCost: real('unit_cost').notNull(),
    itemRevenue: real('item_revenue').notNull(),
    itemCogs: real('item_cogs').notNull(),
    itemProfit: real('item_profit').notNull(),
  },
  (table) => [
    index('idx_order_items_order_id').on(table.orderId),
  ]
);

export const refreshTokensTable = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_refresh_tokens_token').on(table.token),
  ]
);

// Relations
export const productsRelations = relations(productsTable, ({ many }) => ({
  costHistory: many(productCostHistoryTable),
  orderItems: many(orderItemsTable),
}));

export const productCostHistoryRelations = relations(
  productCostHistoryTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productCostHistoryTable.productId],
      references: [productsTable.id],
    }),
  })
);

export const ordersRelations = relations(ordersTable, ({ many }) => ({
  items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.orderId],
    references: [ordersTable.orderId],
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.productId],
    references: [productsTable.id],
  }),
}));
