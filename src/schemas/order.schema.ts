import { z } from 'zod';

// Strict YYYY-MM-DD date format regex
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'Date must be a valid calendar date (e.g. 2026-01-15)',
  });

export const OrderItemSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
  selling_price: z.number().min(0, 'Selling price cannot be negative'),
});

export const CreateOrderSchema = z.object({
  order_id: z.string().trim().min(1, 'order_id is required'),
  created_at: dateString,
  shipping_cost: z.number().min(0, 'shipping_cost cannot be negative'),
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item')
    .refine(
      (items) => {
        const skus = items.map((i) => i.sku.toLowerCase());
        return new Set(skus).size === skus.length;
      },
      { message: 'Duplicate SKUs are not allowed within a single order' }
    ),
});

export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
