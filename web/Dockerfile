# ─── Web (Next.js) ───────────────────────────────────────────────────────────
FROM node:20-alpine AS web-deps
WORKDIR /app
COPY web/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS web-builder
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ .
# Inject production env at build time
ARG NEXT_PUBLIC_API_URL=https://leesrca.kmgvitallinks.com/api/v1
ARG NEXT_PUBLIC_WS_URL=wss://leesrca.kmgvitallinks.com/api/v1/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build

FROM node:20-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=web-builder /app/.next/standalone ./
COPY --from=web-builder /app/.next/static ./.next/static
COPY --from=web-builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
