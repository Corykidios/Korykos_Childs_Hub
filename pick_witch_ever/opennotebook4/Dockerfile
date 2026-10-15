# ==============================================================================
# OpenNotebookLM - Production Multi-Stage Dockerfile
# Stage 1: Build static assets and compile production bundle
# Stage 2: Production runtime preview server with full API & RAG routing
# ==============================================================================

# --- Stage 1: Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy full source tree
COPY . .

# Build production bundle with TypeScript type-checking
RUN pnpm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy dependency manifests and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy compiled production distribution from builder
COPY --from=builder /app/dist ./dist

# Copy Vite server configuration, backend proxy router, and types for API endpoints
COPY vite.config.ts ./
COPY src/server ./src/server
COPY src/types ./src/types

# Environment configuration
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose web application port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Launch OpenNotebookLM with backend proxy support
CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
