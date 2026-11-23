# Projeto 4. E-commerce com fila de e-mail

O ponto de partida é o e-commerce do Projeto 3. O que mudou é o envio do e-mail. O `POST /orders` grava o pedido, publica ele numa lista do Redis e responde. O e-mail fica por conta de um worker, que roda em outro container e lê essa lista.

## Como rodar

```bash
cp .env.example .env
docker compose up --build
```

A API fica em `http://localhost:3000`. Um pedido de teste pode ser este.

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "cliente@ethereal.email",
  "items": [{ "productId": 1, "quantity": 1 }],
  "paymentMethod": "pix"
}'
```

A resposta traz `orderId` e `total`. O link do e-mail de teste aparece no log do worker, não no JSON.

```bash
docker compose logs -f worker
```

O produto `1` é o livro físico, R$ 100 e mais R$ 10 de frete. O `2` é o e-book, R$ 50, sem frete. Os pagamentos do projeto são `pix`, `credit_card` e `debit_card`.

O pedido gravado também pode ser consultado com `curl http://localhost:3000/orders/1`.

Com o worker parado, o pedido espera na fila. Quando o worker volta, o e-mail é enviado.

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

Se quiser dois workers, este comando sobe os dois. Cada pedido é lido por um só, então o e-mail não sai duplicado.

```bash
docker compose up -d --scale worker=2
```

A decisão de usar uma lista do Redis, e não o pub/sub da aula 08, está em `docs/adr-001-fila-de-email.md`.
