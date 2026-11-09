FROM node:22-alpine AS api-build
WORKDIR /src/app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS web-build
WORKDIR /src
COPY . .
RUN mkdir -p /out/public && \
    if [ -f web/package.json ]; then \
      cd web && \
      if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi && \
      npm run build && \
      index_file=$(find dist -name index.html -not -path '*/server/*' | head -n 1) && \
      if [ -n "$index_file" ]; then cp -r "$(dirname "$index_file")"/. /out/public/; fi; \
    fi

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build /src/app/package.json ./package.json
COPY --from=api-build /src/app/node_modules ./node_modules
COPY --from=api-build /src/app/dist ./dist
COPY --from=web-build /out/public ./public
ARG APP_VERSION=dev
ENV PORT=8080 APP_VERSION=$APP_VERSION
USER 1000
EXPOSE 8080
CMD ["node", "--require", "./dist/otel.js", "dist/server.js"]
