# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ── Build the server (with dev deps) ──────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/server/package.json packages/server/package.json
RUN pnpm install --frozen-lockfile --filter server...
COPY packages/server packages/server
RUN pnpm --filter server build
# Produce a self-contained dir with prod deps + built dist.
RUN pnpm --filter server deploy --prod /prod

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /prod ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
