import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { validateBody } from '../middlewares/validate';
import { CreateProductSchema, AddProductCostSchema } from '../schemas/product.schema';

const router = Router();

router.post('/', validateBody(CreateProductSchema), (req, res, next) => {
  productController.createProduct(req, res, next);
});

router.post('/:id/cost', validateBody(AddProductCostSchema), (req, res, next) => {
  productController.addCost(req, res, next);
});

router.get('/:id/cost', (req, res, next) => {
  productController.getCostHistory(req, res, next);
});

export default router;
