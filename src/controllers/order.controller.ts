import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { NotFoundError } from '../middlewares/error-handler';

export class OrderController {
  createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const result = orderService.createOrder(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = orderService.getOrderById(id);
      if (!order) {
        throw new NotFoundError(`Order '${id}' not found`);
      }
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
