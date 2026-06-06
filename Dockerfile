FROM node:24-slim AS builder
ENV CI=true
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24-slim
RUN apt-get update -y && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p tmp/sessions && chown -R node:node tmp
USER node
EXPOSE 44100
ENV NODE_ENV=production
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
