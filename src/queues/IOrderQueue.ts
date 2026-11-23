import { Order } from '../domain/Order';

export interface IOrderQueue {
  publish(order: Order): Promise<void>;
  consume(onOrder: (order: Order) => Promise<void>): Promise<void>;
}
