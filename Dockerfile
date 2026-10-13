# Multi-stage Dockerfile cho Sếp AI Remote - Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt pnpm
RUN npm install -g pnpm

# Copy package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Cài đặt toàn bộ dependencies để build
RUN pnpm install --frozen-lockfile

# Copy mã nguồn
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Build Shared Package và Backend Express
RUN pnpm --filter @sep-ai/shared run build
RUN pnpm --filter @sep-ai/backend run build

# -------------------------------------------------------------
# Runtime Stage
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV PORT=3000

# Cài đặt múi giờ Việt Nam trong container Alpine
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Cài đặt production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy kết quả build từ builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/public ./apps/backend/public

# Thư mục chứa CSDL SQLite bền vững
RUN mkdir -p /app/data /app/apps/backend/public/uploads

EXPOSE 3000

CMD ["node", "apps/backend/dist/index.js"]
