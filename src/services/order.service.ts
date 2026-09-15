import { v4 as uuidv4 } from 'uuid';
import { eq, and, lte, desc, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '../model/database';
import {
  productsTable,
  productCostHistoryTable,
  ordersTable,
  orderItemsTable,
} from '../model/schema';
import { CreateOrderInput } from '../schemas/order.schema';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../middlewares/error-handler';
import { logger } from '../logger';

export interface OrderResponse {
  id: string;
  order_id: string;
  created_at: string;
  shipping_cost: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  processed_at?: string | null;
}

export interface OrderItemResponse {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  selling_price: number;
  unit_cost: number;
  item_revenue: number;
  item_cogs: number;
  item_profit: number;
}

export interface ProcessedOrderResult {
  order: OrderResponse;
  items: OrderItemResponse[];
}

// Pure calculation helper — testable in unit tests without DB
export function calculateItemFinancials(
  quantity: number,
  selling_price: number,
  unit_cost: number
) {
  const item_revenue = quantity * selling_price;
  const item_cogs = quantity * unit_cost;
  const item_profit = item_revenue - item_cogs;
  return { item_revenue, item_cogs, item_profit };
}

export function calculateOrderTotals(
  items: { item_revenue: number; item_cogs: number }[],
  shipping_cost: number
) {
  const total_revenue = items.reduce((sum, i) => sum + i.item_revenue, 0);
  const total_cogs = items.reduce((sum, i) => sum + i.item_cogs, 0);
  const total_profit = total_revenue - total_cogs - shipping_cost;
  return { total_revenue, total_cogs, total_profit };
}

export class OrderService {
  createOrder(input: CreateOrderInput): ProcessedOrderResult {
    const db = getDatabase();

    // Check duplicate order_id
    const existingOrder = db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(eq(ordersTable.orderId, input.order_id))
      .get();

    if (existingOrder) {
      throw new ConflictError(`Order '${input.order_id}' already exists`);
    }

    // Batch fetch all products in a single query (no N+1)
    const inputSkus = input.items.map((i) => i.sku.toUpperCase());
    const products = db
      .select()
      .from(productsTable)
      .where(inArray(sql`UPPER(${productsTable.sku})`, inputSkus))
      .all();

    const productMap = new Map(products.map((p) => [p.sku.toUpperCase(), p]));

    // Validate all products exist before resolving any cost
    for (const item of input.items) {
      if (!productMap.has(item.sku.toUpperCase())) {
        throw new NotFoundError(`Product with SKU '${item.sku}' not found`);
      }
    }

    // Resolve historical cost and compute per-item financials
    const resolvedItems: {
      productId: string;
      sku: string;
      quantity: number;
      selling_price: number;
      unit_cost: number;
      item_revenue: number;
      item_cogs: number;
      item_profit: number;
    }[] = [];

    for (const item of input.items) {
      const product = productMap.get(item.sku.toUpperCase())!;

      const costRecord = db
        .select({ cost: productCostHistoryTable.cost })
        .from(productCostHistoryTable)
        .where(
          and(
            eq(productCostHistoryTable.productId, product.id),
            lte(productCostHistoryTable.effectiveFrom, input.created_at)
          )
        )
        .orderBy(
          desc(productCostHistoryTable.effectiveFrom),
          desc(productCostHistoryTable.createdAt)
        )
        .limit(1)
        .get();

      if (!costRecord) {
        throw new UnprocessableEntityError(
          `No cost record found for SKU '${item.sku}' effective on or before '${input.created_at}'`
        );
      }

      const financials = calculateItemFinancials(
        item.quantity,
        item.selling_price,
        costRecord.cost
      );

      resolvedItems.push({
        productId: product.id,
        sku: product.sku,
        quantity: item.quantity,
        selling_price: item.selling_price,
        unit_cost: costRecord.cost,
        ...financials,
      });
    }

    const { total_revenue, total_cogs, total_profit } = calculateOrderTotals(
      resolvedItems,
      input.shipping_cost
    );

    const orderRecord: OrderResponse = {
      id: uuidv4(),
      order_id: input.order_id,
      created_at: input.created_at,
      shipping_cost: input.shipping_cost,
      total_revenue,
      total_cogs,
      total_profit,
    };

    const orderItems: OrderItemResponse[] = resolvedItems.map((item) => ({
      id: uuidv4(),
      order_id: orderRecord.order_id,
      product_id: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      selling_price: item.selling_price,
      unit_cost: item.unit_cost,
      item_revenue: item.item_revenue,
      item_cogs: item.item_cogs,
      item_profit: item.item_profit,
    }));

    // Atomic insert: order + all items in one transaction
    db.transaction((tx) => {
      tx.insert(ordersTable)
        .values({
          id: orderRecord.id,
          orderId: orderRecord.order_id,
          createdAt: orderRecord.created_at,
          shippingCost: orderRecord.shipping_cost,
          totalRevenue: orderRecord.total_revenue,
          totalCogs: orderRecord.total_cogs,
          totalProfit: orderRecord.total_profit,
        })
        .run();

      for (const item of orderItems) {
        tx.insert(orderItemsTable)
          .values({
            id: item.id,
            orderId: item.order_id,
            productId: item.product_id,
            sku: item.sku,
            quantity: item.quantity,
            sellingPrice: item.selling_price,
            unitCost: item.unit_cost,
            itemRevenue: item.item_revenue,
            itemCogs: item.item_cogs,
            itemProfit: item.item_profit,
          })
          .run();
      }
    });

    logger.info(
      {
        order_id: orderRecord.order_id,
        total_revenue,
        total_cogs,
        total_profit,
        item_count: orderItems.length,
      },
      'Order created successfully'
    );

    return { order: orderRecord, items: orderItems };
  }

  getOrderById(orderId: string): ProcessedOrderResult | undefined {
    const db = getDatabase();
    const orderRow = db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.orderId, orderId))
      .get();

    if (!orderRow) return undefined;

    const itemRows = db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, orderRow.orderId))
      .all();

    return {
      order: {
        id: orderRow.id,
        order_id: orderRow.orderId,
        created_at: orderRow.createdAt,
        shipping_cost: orderRow.shippingCost,
        total_revenue: orderRow.totalRevenue,
        total_cogs: orderRow.totalCogs,
        total_profit: orderRow.totalProfit,
        processed_at: orderRow.processedAt,
      },
      items: itemRows.map((r) => ({
        id: r.id,
        order_id: r.orderId,
        product_id: r.productId,
        sku: r.sku,
        quantity: r.quantity,
        selling_price: r.sellingPrice,
        unit_cost: r.unitCost,
        item_revenue: r.itemRevenue,
        item_cogs: r.itemCogs,
        item_profit: r.itemProfit,
      })),
    };
  }
}

export const orderService = new OrderService();
