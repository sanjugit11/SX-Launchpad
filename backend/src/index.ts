import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './api/routes';
import { apiLimiterDay, apiLimiterMinute } from './security/middlewares';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[API] [${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Global Rate Limiting
app.use(apiLimiterDay);
app.use(apiLimiterMinute);

// Routes
app.use('/api', apiRoutes);

export { app };
export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(port), '127.0.0.1', () => {
    console.log(`SX Launchpad Backend API Gateway running on port ${port}`);
  });
}
