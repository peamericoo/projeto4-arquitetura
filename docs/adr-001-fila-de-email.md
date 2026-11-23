# ADR 001. Fila de e-mail

## Contexto

Antes, o `POST /orders` gravava o pedido e só respondia depois de enviar o e-mail. Se o Ethereal falhasse, a API devolvia erro mesmo com o pedido já salvo no banco. O envio não devia prender a resposta. A API publica o pedido e outro processo cuida do e-mail.

## Decisão

A API grava o pedido e faz `LPUSH` na lista `orders:email` do Redis, pela `RedisOrderQueue`. O `OrderService` só conhece a interface `IOrderQueue`. O worker pega o `NotificationService` no container, lê a lista com `BRPOP` e envia o e-mail.

Na aula 08 o exemplo era pub/sub. Nesse modelo o evento se perde se o ouvinte estiver fora. Uma lista guarda o pedido até o worker voltar, por isso a escolha foi essa e não o pub/sub. Outro problema do pub/sub é que todo assinante recebe uma cópia. Com dois workers o mesmo e-mail sairia duas vezes. O `BRPOP` tira o item da lista uma vez só.

Enquanto a lista está vazia, o `BRPOP` fica esperando o próximo item. Ele não fica consultando a fila o tempo todo.

## Consequências

A resposta da API volta quando o pedido está no banco e o `LPUSH` termina. O link do Ethereal aparece no log do worker.

Com o worker parado, os pedidos ficam na lista e são enviados quando ele volta.

Se o envio falhar depois do `BRPOP`, o item já saiu da lista. O pedido continua no banco, o worker registra o erro e segue para o próximo. Não há reentrega automática.

O cliente do Redis fica só na `RedisOrderQueue`. Services e controllers não importam o Redis.
