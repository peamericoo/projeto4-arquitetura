# E-commerce com fila de e-mail (Projeto 4)

API de pedidos do Projeto 3. O `POST /orders` grava o pedido e coloca ele numa lista do Redis. Um worker, em outro container, lê a lista e envia o e-mail. Assim a resposta volta logo, sem esperar o envio.

## Como rodar

```bash
cp .env.example .env
docker compose up --build
```

A API sobe em `http://localhost:3000`. O Redis fica só na rede do Compose, sem porta no host.

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "cliente@ethereal.email",
  "items": [{ "productId": 1, "quantity": 1 }],
  "paymentMethod": "pix"
}'
```

A resposta traz `orderId` e `total`. O link do e-mail de teste sai no log do worker.

```bash
docker compose logs -f worker
```

Para conferir o pedido gravado, use `curl http://localhost:3000/orders/1`.

O produto `1` é o livro físico, R$ 100 mais R$ 10 de frete. O produto `2` é o e-book, R$ 50, sem frete. Os pagamentos simulados são `pix`, `credit_card` e `debit_card`.

Com o worker parado, o pedido fica na lista. Quando o worker volta, o e-mail sai.

```bash
docker compose stop worker
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "cliente@ethereal.email",
  "items": [{ "productId": 2, "quantity": 1 }],
  "paymentMethod": "pix"
}'
docker compose start worker
docker compose logs worker
```

Para rodar dois workers, use:

```bash
docker compose up -d --scale worker=2
```

Os dois workers dividem a mesma lista, então cada pedido gera um e-mail só.

## Decisões

O `OrderService` depende da interface `IOrderQueue` e não conhece o Redis. A `RedisOrderQueue` grava o pedido com `LPUSH` na lista `orders:email`. O `src/worker.ts` pega o `NotificationService` do container e consome a lista com `BRPOP`.

Usei lista e não publish/subscribe. Com pub/sub, a mensagem se perde se o worker estiver parado, e dois workers mandariam o mesmo e-mail duas vezes. O motivo está registrado em `docs/adr-001-fila-de-email.md`.

O cliente Redis fica só na `RedisOrderQueue`.

## Estrutura

```
src/
├── queues/        # IOrderQueue e RedisOrderQueue
├── worker.ts      # BRPOP e envio do e-mail
├── services/      # OrderService publica na fila
├── container/     # registra RedisOrderQueue
└── ...            # domínio, pagamentos, repositórios e HTTP do Projeto 3
```
