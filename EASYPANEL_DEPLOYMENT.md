## Guia de Deploy no EasyPanel

Siga estes passos para fazer o deploy da sua API Baileys no EasyPanel usando o Docker.

### Passo 1: Prepare seu Projeto

1.  **Faça o upload do projeto:** Envie a pasta `baileys-api` para o seu servidor onde o EasyPanel está rodando. Você pode fazer isso via `scp` ou qualquer cliente FTP.

2.  **Acesse o servidor:** Conecte-se ao seu servidor via SSH.

### Passo 2: Crie um Novo Projeto no EasyPanel

1.  Acesse seu painel do EasyPanel.
2.  Vá para a seção **Projects** e clique em **New**.
3.  Dê um nome ao seu projeto (ex: `baileys-api-project`) e clique em **Create**.

### Passo 3: Configure o Serviço no EasyPanel

Dentro do seu novo projeto, vamos criar um serviço para a API.

1.  Clique em **+ Service**.
2.  Selecione **App** como o tipo de serviço.
3.  Na tela de configuração do serviço, preencha os seguintes campos:

    *   **Source:** Selecione **Docker Compose**.
    *   **Compose File:** Copie e cole o conteúdo do arquivo `docker-compose.yml` que eu criei.

        ```yaml
        version: '3.8'
        services:
          baileys-api:
            build:
              context: .
              dockerfile: Dockerfile
            container_name: baileys-api
            restart: unless-stopped
            ports:
              - "3000:3000"
            volumes:
              - ./sessions:/app/sessions
            environment:
              - PORT=3000
              - NODE_ENV=production
              - WEBHOOK_URL=http://your-app-url/webhooks/baileys
              - WEBHOOK_SECRET=88858858uujjdjdjjdiqd9id2xjkx
              - SESSION_PATH=./sessions
              - LOG_LEVEL=info
        ```

    *   **Environment Variables:** O EasyPanel irá extrair as variáveis de ambiente do `docker-compose.yml`. Você **precisa** editar os valores de `WEBHOOK_URL` e `WEBHOOK_SECRET` para corresponderem à sua configuração real.

        -   `WEBHOOK_URL`: Esta será a URL da sua função `baileys-webhook` no Supabase. Será algo como `https://<seu-projeto-supabase>.supabase.co/functions/v1/baileys-webhook`.
        -   `WEBHOOK_SECRET`: Uma chave secreta forte para proteger seu webhook.

    *   **Build & Start Commands:** O EasyPanel usará o `Dockerfile` e o `docker-compose.yml` para fazer o build e iniciar a aplicação, então você não precisa preencher comandos de build e start manualmente.

### Passo 4: Deploy

1.  Depois de configurar o serviço, clique em **Deploy**.
2.  O EasyPanel irá ler o `docker-compose.yml`, construir a imagem Docker a partir do seu `Dockerfile` e iniciar o container.
3.  Você pode acompanhar os logs do deploy diretamente na interface do EasyPanel para verificar se tudo ocorreu bem.

### Passo 5: Configurar o Domínio (Opcional, mas Recomendado)

1.  No seu serviço dentro do EasyPanel, vá para a aba **Domains**.
2.  Adicione um domínio ou subdomínio para a sua API (ex: `baileys-api.seusite.com`).
3.  O EasyPanel irá configurar automaticamente o proxy reverso e o SSL (HTTPS) para você.

É isso! Sua API Baileys estará rodando no EasyPanel, pronta para ser usada pelo seu App IA Plus.
