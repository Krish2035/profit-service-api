import { z } from 'zod';

// Strict YYYY-MM-DD date format regex
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'Date must be a valid calendar date (e.g. 2026-01-15)',
  });

export const CreateProductSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  name: z.string().trim().min(1, 'Name is required'),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const AddProductCostSchema = z.object({
  cost: z.number().min(0, 'Cost must not be negative'),
  effective_from: dateString,
});

export type AddProductCostInput = z.infer<typeof AddProductCostSchema>;
