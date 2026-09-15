import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  productsTable,
  productCostHistoryTable,
  ordersTable,
  orderItemsTable,
} from './schema';

export type Product = InferSelectModel<typeof productsTable>;
export type NewProduct = InferInsertModel<typeof productsTable>;

export type ProductCostHistory = InferSelectModel<typeof productCostHistoryTable>;
export type NewProductCostHistory = InferInsertModel<typeof productCostHistoryTable>;

export type Order = InferSelectModel<typeof ordersTable>;
export type NewOrder = InferInsertModel<typeof ordersTable>;

export type OrderItem = InferSelectModel<typeof orderItemsTable>;
export type NewOrderItem = InferInsertModel<typeof orderItemsTable>;

export interface DashboardMetrics {
  revenue: number;
  cogs: number;
  shipping: number;
  profit: number;
  page: number;
  limit: number;
  total_orders: number;
}
