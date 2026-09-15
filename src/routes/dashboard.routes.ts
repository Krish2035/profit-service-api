import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

router.get('/', (req, res, next) => {
  dashboardController.getDashboard(req, res, next);
});

export default router;
