import { createClient } from 'redis';
import { injectable } from 'inversify';
import logger from '../lib/logger';
import { Order } from '../domain/Order';
import { IOrderQueue } from './IOrderQueue';

const ORDER_EMAIL_QUEUE = 'orders:email';

type RedisClient = ReturnType<typeof createClient>;

@injectable()
export class RedisOrderQueue implements IOrderQueue {
  private publisher: RedisClient | null = null;
  private stopping = false;

  async publish(order: Order): Promise<void> {
    const client = await this.getPublisher();
    await client.lPush(ORDER_EMAIL_QUEUE, JSON.stringify(order));
  }

  async consume(onOrder: (order: Order) => Promise<void>): Promise<void> {
    let client = await this.open();
    logger.info('Worker conectado na fila de e-mail');

    while (!this.stopping) {
      try {
        const message = await client.brPop(ORDER_EMAIL_QUEUE, 0);
        if (!message) continue;
        await this.deliver(message.element, onOrder);
      } catch (error) {
        if (this.stopping) return;
        const detail = error instanceof Error ? error.message : String(error);
        logger.error(`Falha ao ler a fila: ${detail}`);
        await this.wait(1000);
        client = await this.reopen(client);
      }
    }
  }

  private async deliver(payload: string, onOrder: (order: Order) => Promise<void>): Promise<void> {
    let order: Order;
    try {
      order = JSON.parse(payload) as Order;
    } catch {
      logger.error('Pedido inválido na fila');
      return;
    }

    try {
      await onOrder(order);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error(`Falha ao enviar e-mail do pedido ${order.id}: ${detail}`);
    }
  }

  private async reopen(client: RedisClient): Promise<RedisClient> {
    try {
      if (client.isOpen) await client.disconnect();
    } catch {
      return this.open();
    }
    return this.open();
  }

  private async getPublisher(): Promise<RedisClient> {
    if (this.publisher?.isOpen) return this.publisher;
    this.publisher = await this.open();
    return this.publisher;
  }

  private async open(): Promise<RedisClient> {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL não definida');

    let lastError: unknown;
    for (let attempt = 1; attempt <= 10; attempt++) {
      const client = createClient({ url });
      client.on('error', (error) => {
        logger.error(`Redis: ${error.message}`);
      });
      try {
        await client.connect();
        return client;
      } catch (error) {
        lastError = error;
        logger.error(`Redis indisponível, tentativa ${attempt}`);
        await this.wait(1000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Redis indisponível');
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
