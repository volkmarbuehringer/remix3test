FROM node:26-slim AS builder
ENV CI=true
WORKDIR /app
# pin pnpm to package.json's packageManager version; Node 26 images do not
# bundle corepack.
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:26-slim
RUN apt-get update -y && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p tmp/sessions && chown -R node:node tmp
USER node
EXPOSE 44100
ENV NODE_ENV=production
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
