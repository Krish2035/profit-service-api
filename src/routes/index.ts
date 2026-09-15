import { Router } from 'express';
import productRoutes from './product.routes';
import orderRoutes from './order.routes';
import dashboardRoutes from './dashboard.routes';
import authRoutes from './auth.routes';

const router = Router();

// Public auth routes (no JWT required)
router.use('/v1/auth', authRoutes);

// Protected v1 API routes (JWT required — enforced in app.ts after authMiddleware)
const v1Router = Router();
v1Router.use('/products', productRoutes);
v1Router.use('/orders', orderRoutes);
v1Router.use('/dashboard', dashboardRoutes);

router.use('/v1', v1Router);

export default router;
