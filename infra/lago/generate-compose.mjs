// Builds restart-billing.compose.yml from restart-billing.compose.before.yml (the stock
// upstream compose) plus the patch sources next to it:
//   - api.Dockerfile      -> an inline build for api, api-worker and api-clock
//   - patch-front.mjs     -> embedded in an inline build of the front end
// Usage:  node generate-compose.mjs <image-tag>      e.g.  node generate-compose.mjs v1.53.0-p5
// The image tag must change with every patch edit so Coolify rebuilds; keep it
// "<upstream version>-p<n>". Read README.md before changing anything here.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const dir = fileURLToPath(new URL('./', import.meta.url))
const TAG = process.argv[2]
if (!TAG) throw new Error('usage: node generate-compose.mjs <image-tag>, e.g. v1.53.0-p5')
let c = readFileSync(dir + 'restart-billing.compose.before.yml', 'utf8').replace(/\r\n/g, '\n')
const esc = (s) => s.split('$').join('$$')
const ind = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n')

// API inline Dockerfile: FROM + each RUN collapsed to a single line, comments dropped.
const apiSrc = readFileSync(dir + 'api.Dockerfile', 'utf8').replace(/\r\n/g, '\n')
const apiLines = []
let cur = ''
for (const raw of apiSrc.split('\n')) {
  if (!cur && (raw.startsWith('#') || raw.trim() === '')) continue
  if (raw.endsWith('\\')) { cur += raw.slice(0, -1).trim() + ' '; continue }
  apiLines.push(cur + raw.trim())
  cur = ''
}
const apiDocker = esc(apiLines.join('\n'))
const apiBuild = `    image: 'restart/lago-api:${TAG}'
    pull_policy: build
    build:
      dockerfile_inline: |
${ind(apiDocker, 8)}`
c = c.split("    image: 'getlago/api:v1.48.1'").join(apiBuild)

// Front inline Dockerfile: upstream stages with the patch script embedded via heredoc.
const script = esc(readFileSync(dir + 'patch-front.mjs', 'utf8').replace(/\r\n/g, '\n'))
const frontDocker = `FROM node:24.20.0-alpine AS deps
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
COPY <<'PATCH_EOF' /tmp/patch-front.mjs
${script}PATCH_EOF
RUN node /tmp/patch-front.mjs
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
ENTRYPOINT ["/bin/bash", "-c", "./.env.sh && exec nginx -g \\"daemon off;\\""]
`
const frontBuild = `    image: 'restart/lago-front:${TAG}'
    pull_policy: build
    build:
      context: 'https://github.com/getlago/lago-front.git#v1.53.0'
      dockerfile_inline: |
${ind(frontDocker, 8)}`
c = c.split("    image: 'getlago/front:v1.48.1'").join(frontBuild.trimEnd())
if (c.includes('v1.48.1')) throw new Error('unreplaced 1.48.1')
writeFileSync(dir + 'restart-billing.compose.yml', c)
console.log('ok', c.length)
