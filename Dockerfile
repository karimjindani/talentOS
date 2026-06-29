# Shared multi-stage build for both TalentOS web containers.
# Parameterized by APP_NAME (workspace) and APP_DIR (app folder) so the
# applicant and admin modules build from one source of truth.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/applicant/package.json apps/applicant/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/auth-web/package.json packages/auth-web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
RUN npm install --no-save --ignore-scripts @next/swc-linux-x64-gnu@15.5.19

FROM node:24-slim AS builder
ARG APP_NAME
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build -w ${APP_NAME}

FROM node:24-slim AS runner
ARG APP_DIR
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_DIR=${APP_DIR}
COPY --from=builder /app/${APP_DIR}/.next/standalone ./
COPY --from=builder /app/${APP_DIR}/.next/static ./${APP_DIR}/.next/static
COPY --from=builder /app/${APP_DIR}/public ./${APP_DIR}/public
EXPOSE 3000
CMD node $APP_DIR/server.js
