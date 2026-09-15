import { sql } from 'drizzle-orm';
import { getDatabase } from '../model/database';
import { ordersTable } from '../model/schema';
import { DashboardMetrics } from '../model/types';

export class DashboardService {
  getMetrics(page: number = 1, limit: number = 20): DashboardMetrics {
    const db = getDatabase();
    const offset = (page - 1) * limit;

    // Get paginated order aggregations
    const result = db
      .select({
        revenue: sql<number>`COALESCE(SUM(${ordersTable.totalRevenue}), 0)`,
        cogs: sql<number>`COALESCE(SUM(${ordersTable.totalCogs}), 0)`,
        shipping: sql<number>`COALESCE(SUM(${ordersTable.shippingCost}), 0)`,
        profit: sql<number>`COALESCE(SUM(${ordersTable.totalProfit}), 0)`,
      })
      .from(ordersTable)
      .limit(limit)
      .offset(offset)
      .get();

    // Get total count for pagination metadata
    const countResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(ordersTable)
      .get();

    const total_orders = countResult?.count ?? 0;

    return {
      revenue: Number((result?.revenue ?? 0).toFixed(2)),
      cogs: Number((result?.cogs ?? 0).toFixed(2)),
      shipping: Number((result?.shipping ?? 0).toFixed(2)),
      profit: Number((result?.profit ?? 0).toFixed(2)),
      page,
      limit,
      total_orders,
    };
  }
}

export const dashboardService = new DashboardService();
