# ==========================================
# Multi-Stage Production Dockerfile
# ==========================================

# ----------------- Stage 1: Builder -----------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native C++ addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# ----------------- Stage 2: Production Runner -----------------
FROM node:22-alpine AS runner

WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application and schema assets from builder stage
COPY --from=builder /app/dist ./dist
COPY src/model/schema.sql ./dist/model/schema.sql
COPY src/model/schema.postgres.sql ./dist/model/schema.postgres.sql

# Set ownership of all files to the non-root 'node' user
RUN chown -R node:node /app

# Switch to non-root user for runtime security
USER node

# Expose API port
EXPOSE 3000

# Docker healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the production server
CMD ["node", "dist/server.js"]
