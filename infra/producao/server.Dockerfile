# Imagem do server que também entrega o site (WEB_DIST). Contexto de build: a raiz do repositório.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.6.0
WORKDIR /app

FROM base AS site
COPY . .
# Sem scripts: nada do site ou do server precisa compilar nativo, e o prepare do Lefthook não serve aqui.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @telando/web...
RUN pnpm --filter @telando/web build

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter @telando/server...

FROM base
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/core packages/core
COPY --from=deps /app/apps/server apps/server
COPY --from=site /app/apps/web/dist apps/web/dist
RUN mkdir /data && chown node:node /data
USER node
WORKDIR /app/apps/server
CMD ["node", "src/main.ts"]
