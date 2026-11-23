import { inject, injectable } from 'inversify';
import { TYPES } from '../container/types';
import logger from '../lib/logger';
import { NotFoundError, ValidationError } from '../domain/errors';
import { OrderItem, OrderLine } from '../domain/Order';
import { ProductFactory } from '../domain/ProductFactory';
import { IProductRepository } from '../repositories/IProductRepository';
import { IOrderRepository } from '../repositories/IOrderRepository';
import { PaymentMethodRegistry } from '../payments/PaymentMethodRegistry';
import { IOrderQueue } from '../queues/IOrderQueue';

@injectable()
export class OrderService {
  constructor(
    @inject(TYPES.ProductRepository) private products: IProductRepository,
    @inject(TYPES.OrderRepository) private orders: IOrderRepository,
    @inject(PaymentMethodRegistry) private payments: PaymentMethodRegistry,
    @inject(TYPES.OrderQueue) private queue: IOrderQueue,
  ) {}

  async placeOrder(customer: string, items: OrderItem[], paymentMethod: string, paymentDetails: any) {
    if (!items || items.length === 0) {
      logger.error('Tentativa de pedido sem itens');
      throw new ValidationError('Carrinho vazio');
    }

    let total = 0;
    const lines: OrderLine[] = [];
    for (const item of items) {
      const data = await this.products.findById(item.productId);
      if (!data) throw new ValidationError(`Produto ${item.productId} não encontrado`);

      const product = ProductFactory.create(data);
      total += product.price * item.quantity + product.calculateFreight();
      lines.push({ productId: product.id, name: product.name, price: product.price, quantity: item.quantity });
    }

    const payment = this.payments.get(paymentMethod);
    if (!payment) throw new ValidationError('Método de pagamento não suportado');
    await payment.process(total, paymentDetails);

    const order = await this.orders.create(customer, lines, total);
    await this.queue.publish(order);
    logger.info(`Pedido ${order.id} publicado na fila de e-mail`);

    return { orderId: order.id, total };
  }

  async getOrder(id: number) {
    const order = Number.isInteger(id) ? await this.orders.findById(id) : null;
    if (!order) throw new NotFoundError('Pedido não encontrado');
    return order;
  }
}
