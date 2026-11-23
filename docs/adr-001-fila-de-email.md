# ADR 001. Fila de e-mail

## Contexto

O `POST /orders` gravava o pedido e só respondia depois de enviar o e-mail. O Ethereal fazia parte dessa espera. Se a conta de teste falhasse, a API devolvia erro mesmo com o pedido já salvo no banco.

A confirmação não deveria travar a requisição. A API publica o pedido e segue, e outro processo envia o e-mail.

## Decisão

A API grava o pedido e faz `LPUSH` na lista `orders:email` do Redis, pela `RedisOrderQueue`. Um worker, em outro container, espera a lista com `BRPOP` e chama o `NotificationService` para cada pedido.

`LPUSH` com `BRPOP` mantém a ordem de chegada. O `BRPOP` não fica consultando a lista o tempo todo. Quando a lista está vazia, ele fica bloqueado até chegar um item.

O `BRPOP` é atômico, então dois workers na mesma lista recebem pedidos diferentes. Cada pedido gera um e-mail só.

Pub/sub não serve. A mensagem não fica guardada, então com o worker parado o e-mail se perde. Cada assinante também recebe uma cópia, e dois workers mandariam o mesmo e-mail duas vezes.

O `OrderService` só conhece a interface `IOrderQueue`. A classe do Redis é registrada no container, e o worker pega o `NotificationService` desse mesmo container.

## Consequências

A resposta volta assim que a gravação e o `LPUSH` terminam. O link do Ethereal aparece no log do worker, não no JSON da API.

Com o worker parado, os pedidos ficam na lista. Quando o container volta, o `BRPOP` consome o que acumulou.

Se o envio falhar depois do `BRPOP`, o item já saiu da lista. O pedido continua no banco, o worker registra o erro e segue para o próximo. Não há reentrega automática.

Services e controllers não importam o cliente do Redis.
