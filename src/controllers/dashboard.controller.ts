import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';

export class DashboardController {
  getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

      const metrics = dashboardService.getMetrics(page, limit);
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
