import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { validateBody } from '../middlewares/validate';
import { CreateOrderSchema } from '../schemas/order.schema';

const router = Router();

router.post('/', validateBody(CreateOrderSchema), (req, res, next) => {
  orderController.createOrder(req, res, next);
});

router.get('/:id', (req, res, next) => {
  orderController.getOrder(req, res, next);
});

export default router;
