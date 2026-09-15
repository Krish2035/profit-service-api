import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';

export class ProductController {
  createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = productService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  addCost(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const costRecord = productService.addCost(id, req.body);
      res.status(201).json(costRecord);
    } catch (error) {
      next(error);
    }
  }

  getCostHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const history = productService.getCostHistory(id);
      res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
