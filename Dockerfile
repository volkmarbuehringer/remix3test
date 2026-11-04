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
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e 'const https=require("https");const port=Number(process.env.PORT||44100);const req=https.request({host:"127.0.0.1",port,path:"/health",rejectUnauthorized:false,timeout:3000},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on("timeout",()=>{req.destroy();process.exit(1)});req.on("error",()=>process.exit(1));req.end()'
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
