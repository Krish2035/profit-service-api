import { v4 as uuidv4 } from 'uuid';
import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '../model/database';
import { productsTable, productCostHistoryTable } from '../model/schema';
import { CreateProductInput, AddProductCostInput } from '../schemas/product.schema';
import { ConflictError, NotFoundError } from '../middlewares/error-handler';

export interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  created_at?: string | null;
}

export interface ProductCostHistoryResponse {
  id: string;
  product_id: string;
  cost: number;
  effective_from: string;
  created_at?: string | null;
}

export class ProductService {
  createProduct(input: CreateProductInput): ProductResponse {
    const db = getDatabase();

    // Check duplicate SKU
    const existing = db
      .select()
      .from(productsTable)
      .where(sql`UPPER(${productsTable.sku}) = UPPER(${input.sku})`)
      .get();

    if (existing) {
      throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
    }

    const id = uuidv4();
    const newProduct = {
      id,
      sku: input.sku,
      name: input.name,
    };

    db.insert(productsTable).values(newProduct).run();

    return newProduct;
  }

  getProductByIdOrSku(idOrSku: string): ProductResponse | undefined {
    const db = getDatabase();
    const row = db
      .select()
      .from(productsTable)
      .where(sql`${productsTable.id} = ${idOrSku} OR UPPER(${productsTable.sku}) = UPPER(${idOrSku})`)
      .get();

    if (!row) return undefined;
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      created_at: row.createdAt,
    };
  }

  addCost(idOrSku: string, input: AddProductCostInput): ProductCostHistoryResponse {
    const db = getDatabase();
    const product = this.getProductByIdOrSku(idOrSku);

    if (!product) {
      throw new NotFoundError(`Product '${idOrSku}' not found`);
    }

    const costId = uuidv4();
    db.insert(productCostHistoryTable)
      .values({
        id: costId,
        productId: product.id,
        cost: input.cost,
        effectiveFrom: input.effective_from,
      })
      .run();

    return {
      id: costId,
      product_id: product.id,
      cost: input.cost,
      effective_from: input.effective_from,
    };
  }

  getCostHistory(productId: string): ProductCostHistoryResponse[] {
    const db = getDatabase();
    const rows = db
      .select()
      .from(productCostHistoryTable)
      .where(eq(productCostHistoryTable.productId, productId))
      .orderBy(sql`${productCostHistoryTable.effectiveFrom} DESC, ${productCostHistoryTable.createdAt} DESC`)
      .all();

    return rows.map((r) => ({
      id: r.id,
      product_id: r.productId,
      cost: r.cost,
      effective_from: r.effectiveFrom,
      created_at: r.createdAt,
    }));
  }
}

export const productService = new ProductService();
