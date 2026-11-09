FROM node:22-alpine AS landing
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund
RUN mkdir -p app/public resources \
    && if [ -f web/package.json ]; then \
         npm run build -w web \
         && browser_dir="$(find web/dist -maxdepth 3 -type d -name browser | head -n 1)" \
         && cp -r "$browser_dir"/. app/public/; \
       fi
COPY --from=landing /frontend/dist ./app/public/landing
RUN npm run build -w app && npm run build:scripts
RUN mkdir /manifests \
    && tar cf - package.json package-lock.json shared/package.json app/package.json $(ls web/package.json 2>/dev/null) \
       | tar xf - -C /manifests

FROM node:22-alpine AS runtime
WORKDIR /repo
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 APP_VERSION=$APP_VERSION
COPY --from=build /manifests ./
RUN npm ci --omit=dev --workspace app --no-audit --no-fund
COPY --from=build /repo/app/dist ./app/dist
COPY --from=build /repo/scripts/dist ./scripts/dist
COPY --from=build /repo/app/public ./app/public
COPY --from=build /repo/resources ./resources
USER 1000
EXPOSE 8080
CMD ["node", "--require", "./app/dist/otel.js", "app/dist/server.js"]
