import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import logger from '../lib/logger';
import { NotFoundError, PaymentError, ValidationError } from '../domain/errors';
import { OrderService } from '../services/OrderService';

@injectable()
export class OrderController {
  constructor(@inject(OrderService) private orderService: OrderService) {}

  processOrder = async (req: Request, res: Response) => {
    try {
      const { customer, items, paymentMethod, paymentDetails } = req.body;
      const result = await this.orderService.placeOrder(customer, items, paymentMethod, paymentDetails);
      return res.json({ message: 'Pedido processado com sucesso', ...result });
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof PaymentError) {
        return res.status(400).json({ error: error.message });
      }
      logger.error(`Erro ao processar pedido: ${error.message}`);
      return res.status(500).json({ error: 'Erro interno' });
    }
  };

  getOrder = async (req: Request, res: Response) => {
    try {
      const order = await this.orderService.getOrder(Number(req.params.id));
      return res.json(order);
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      logger.error(`Erro ao buscar pedido: ${error.message}`);
      return res.status(500).json({ error: 'Erro interno' });
    }
  };
}
