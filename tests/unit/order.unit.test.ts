import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemFinancials,
  calculateOrderTotals,
} from '../../src/services/order.service';

describe('Order Service — Unit Tests (Pure Functions)', () => {
  describe('calculateItemFinancials', () => {
    it('should calculate item revenue, COGS, and profit correctly', () => {
      const result = calculateItemFinancials(2, 999, 350);

      // Revenue = 2 * 999 = 1998
      assert.equal(result.item_revenue, 1998);

      // COGS = 2 * 350 = 700
      assert.equal(result.item_cogs, 700);

      // Profit = 1998 - 700 = 1298
      assert.equal(result.item_profit, 1298);
    });

    it('should return zero profit when selling price equals unit cost', () => {
      const result = calculateItemFinancials(5, 100, 100);

      assert.equal(result.item_revenue, 500);
      assert.equal(result.item_cogs, 500);
      assert.equal(result.item_profit, 0);
    });

    it('should correctly handle negative profit (selling below cost)', () => {
      const result = calculateItemFinancials(1, 200, 400);

      assert.equal(result.item_revenue, 200);
      assert.equal(result.item_cogs, 400);
      assert.equal(result.item_profit, -200);
    });

    it('should handle decimal selling price and unit cost correctly', () => {
      const result = calculateItemFinancials(3, 99.99, 49.99);

      assert.equal(Number(result.item_revenue.toFixed(2)), 299.97);
      assert.equal(Number(result.item_cogs.toFixed(2)), 149.97);
      assert.equal(Number(result.item_profit.toFixed(2)), 150.00);
    });

    it('should handle a single unit correctly', () => {
      const result = calculateItemFinancials(1, 999, 400);
      assert.equal(result.item_revenue, 999);
      assert.equal(result.item_cogs, 400);
      assert.equal(result.item_profit, 599);
    });
  });

  describe('calculateOrderTotals', () => {
    it('should correctly aggregate totals across multiple items with shipping', () => {
      const items = [
        { item_revenue: 1998, item_cogs: 700 },
        { item_revenue: 3000, item_cogs: 1200 },
      ];

      const result = calculateOrderTotals(items, 60);

      // Revenue: 1998 + 3000 = 4998
      assert.equal(result.total_revenue, 4998);

      // COGS: 700 + 1200 = 1900
      assert.equal(result.total_cogs, 1900);

      // Profit: 4998 - 1900 - 60 = 3038
      assert.equal(result.total_profit, 3038);
    });

    it('should return zero profit when revenue equals COGS plus shipping', () => {
      const items = [{ item_revenue: 1000, item_cogs: 940 }];
      const result = calculateOrderTotals(items, 60);

      assert.equal(result.total_revenue, 1000);
      assert.equal(result.total_cogs, 940);
      assert.equal(result.total_profit, 0);
    });

    it('should handle zero shipping cost correctly', () => {
      const items = [{ item_revenue: 500, item_cogs: 200 }];
      const result = calculateOrderTotals(items, 0);

      assert.equal(result.total_profit, 300);
    });

    it('should handle a single item order', () => {
      const items = [{ item_revenue: 1998, item_cogs: 700 }];
      const result = calculateOrderTotals(items, 60);

      // Matches the exact example from requirements:
      // Revenue=1998, COGS=700, Shipping=60, Profit=1238
      assert.equal(result.total_revenue, 1998);
      assert.equal(result.total_cogs, 700);
      assert.equal(result.total_profit, 1238);
    });
  });
});
