# Dockerfile.app
FROM node:22-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Avoid running prisma generate during install (schema not copied yet)
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1

# Install deps with a cached pnpm store
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Bring in schema and the rest of the source
COPY prisma ./prisma
COPY . .

# Now generate Prisma Client (schema is present)
RUN pnpm prisma generate --schema prisma/schema.prisma

# Build Next.js app
RUN pnpm run build

ENV PORT=3000

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec next start -p ${PORT}"]

