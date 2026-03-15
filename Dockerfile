# Estágio de Build
FROM node:20-alpine AS builder

# Define o diretório de trabalho
WORKDIR /app

# Instala git e outras dependências necessárias para compilar módulos nativos
RUN apk add --no-cache git python3 make g++

# Copia os arquivos de dependências
COPY package.json package-lock.json* ./

# Instala todas as dependências (incluindo devDependencies necessárias para o build)
RUN npm install

# Copia o restante do código-fonte
COPY . .

# Compila o código TypeScript para JavaScript
RUN npm run build

# Remove as dependências de desenvolvimento após o build
RUN npm prune --production

# Estágio de Produção
FROM node:20-alpine

WORKDIR /app

# Instala git (pode ser necessário em runtime para algumas operações)
RUN apk add --no-cache git

RUN apk add --no-cache git curl

# Copia as dependências instaladas e o código compilado do estágio de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Expõe a porta que a aplicação irá rodar
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando para iniciar a aplicação
CMD ["npm", "start"]
