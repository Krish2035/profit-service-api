# ==========================================
# Multi-Stage Production Dockerfile
# ==========================================

# ----------------- Stage 1: Builder -----------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# ----------------- Stage 2: Production Runner -----------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
USER node

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application and assets from builder stage
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node src/model/schema.sql ./dist/model/schema.sql
COPY --chown=node:node src/model/schema.postgres.sql ./dist/model/schema.postgres.sql

# Expose API port
EXPOSE 3000

# Docker healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the production server
CMD ["node", "dist/server.js"]
