# Lago front end with "Record a payment" unlocked. Stages mirror upstream's Dockerfile
# at v1.53.0; the only addition is the patch step. Build with the upstream repo as the
# context and this directory as a named context for the patch script:
#   docker buildx build -f front.Dockerfile --build-context patch=. \
#     -t restart/lago-front:v1.53.0 https://github.com/getlago/lago-front.git#v1.53.0
FROM node:24.20.0-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 build-base && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/configs/package.json ./packages/configs/
COPY packages/design-system/package.json ./packages/design-system/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24.20.0-alpine AS build
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN apk add --no-cache python3 build-base && corepack enable
COPY --from=deps /app /app
COPY . .
COPY --from=patch patch-front.mjs /tmp/patch-front.mjs
RUN node /tmp/patch-front.mjs
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
RUN pnpm build

FROM nginx:1.31-alpine AS runtime
WORKDIR /usr/share/nginx/html
RUN apk upgrade --no-cache && apk add --no-cache bash
COPY --from=build /app/dist .
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/gzip.conf /etc/nginx/conf.d/gzip.conf
COPY ./nginx/csp.conf /etc/nginx/conf.d/csp.conf
COPY ./.env.sh ./.env.sh
EXPOSE 80
ENTRYPOINT ["/bin/bash", "-c", "./.env.sh && exec nginx -g \"daemon off;\""]
