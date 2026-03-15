# API REST para Baileys Multi-Instância

Esta é uma API REST construída com Express.js para gerenciar múltiplas instâncias de WhatsApp usando a biblioteca Baileys. Ela foi projetada para ser usada como um serviço de backend para o App IA Plus, substituindo a API Evolution.

## Funcionalidades

- **Multi-instância:** Gerencie múltiplas contas de WhatsApp simultaneamente.
- **API RESTful:** Endpoints para criar, gerenciar e interagir com as instâncias.
- **Autenticação por QR Code:** Obtenha o QR code para autenticação via API.
- **Envio de Mensagens:** Endpoint para enviar mensagens de texto.
- **Webhooks:** Envia eventos (status da conexão, novas mensagens) para um endpoint configurado.
- **Gerenciamento de Sessão:** As sessões são salvas localmente para reconexão automática.

## Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn

## Instalação

1.  Clone este repositório:
    ```bash
    git clone <url-do-repositorio>
    cd baileys-api
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

## Configuração

1.  Crie um arquivo `.env` na raiz do projeto, copiando o exemplo de `.env.example`:
    ```bash
    cp .env.example .env
    ```

2.  Edite o arquivo `.env` com as suas configurações:

    ```env
    # Porta em que o servidor da API irá rodar
    PORT=3000

    # URL para onde os eventos de webhook serão enviados (o futuro `baileys-webhook` no App IA Plus)
    WEBHOOK_URL=http://localhost:8000/functions/v1/baileys-webhook

    # Chave secreta para validar os webhooks (opcional, mas recomendado)
    WEBHOOK_SECRET=sua-chave-secreta

    # Caminho para salvar os arquivos de sessão
    SESSION_PATH=./sessions

    # Nível de log (trace, debug, info, warn, error, fatal, silent)
    LOG_LEVEL=info
    ```

## Como Executar

-   **Modo de Desenvolvimento (com hot-reload):**
    ```bash
    npm run dev
    ```

-   **Build para Produção:**
    ```bash
    npm run build
    ```

-   **Executar em Produção (após o build):**
    ```bash
    npm start
    ```

## Endpoints da API

Todos os endpoints estão sob o prefixo `/api`.

### `POST /api/instance/create`

Cria uma nova instância de Baileys.

-   **Body (JSON):**
    ```json
    {
      "instanceId": "seu-agent-id"
    }
    ```

### `GET /api/instance/qr/:instanceId`

Retorna o QR code para autenticação em formato de imagem HTML. Abra esta URL em um navegador para escanear.

### `GET /api/instance/status/:instanceId`

Retorna o status da conexão da instância.

### `POST /api/instance/send/:instanceId`

Envia uma mensagem de texto.

-   **Body (JSON):**
    ```json
    {
      "to": "5511999999999",
      "text": "Olá, mundo!"
    }
    ```

### `DELETE /api/instance/delete/:instanceId`

Desconecta e remove uma instância.

### `GET /api/instances`

Lista todas as instâncias ativas e seus status.

## Webhooks

A API enviará eventos para a `WEBHOOK_URL` configurada no `.env`. O payload do webhook terá a seguinte estrutura:

```json
{
  "instanceId": "seu-agent-id",
  "event": "connection.update", // ou "messages.upsert"
  "data": { ...dados do evento... }
}
```

## Próximos Passos

1.  Hospede esta API em um servidor (por exemplo, Render, Heroku, ou um VPS).
2.  Implemente o **Passo 2** do plano de integração: modificar as Supabase Functions do App IA Plus para chamar os endpoints desta API.
