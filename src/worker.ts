import 'reflect-metadata';
import 'dotenv/config';
import { container } from './container/container';
import { TYPES } from './container/types';
import logger from './lib/logger';
import { IOrderQueue } from './queues/IOrderQueue';
import { NotificationService } from './services/NotificationService';

const notification = container.get(NotificationService);
const queue = container.get<IOrderQueue>(TYPES.OrderQueue);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

logger.info('Worker de e-mail iniciado');

queue.consume(async (order) => {
  const preview = await notification.orderConfirmed(order);
  logger.info(`E-mail enviado para ${order.customer} sobre o pedido ${order.id}: ${preview ?? 'sem preview'}`);
}).catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  logger.error(`Worker encerrado: ${detail}`);
  process.exit(1);
});
