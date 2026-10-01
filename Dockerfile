# ---------------------------------------------------
# Stage 1: Build & Dependencies
# ---------------------------------------------------
FROM oven/bun:1.3-slim AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json* ./

RUN bun build ./src/index.ts --outdir ./dist --target bun --minify --sourcemap=none

# Prune unused cross-platform ONNX binaries
RUN rm -rf \
    node_modules/onnxruntime-node/bin/napi-v6/win32 \
    node_modules/onnxruntime-node/bin/napi-v6/darwin \
    node_modules/onnxruntime-node/bin/napi-v6/linux/arm* \
    node_modules/@types

# ---------------------------------------------------
# Stage 2: Ultra-lightweight Runner
# ---------------------------------------------------
FROM oven/bun:1.3-slim AS release

ENV NODE_ENV=production
ENV HOME=/home/bun
ENV HF_HOME=/home/bun/.cache
ENV TRANSFORMERS_CACHE=/home/bun/.cache
ENV PORT=4003

WORKDIR /app

RUN mkdir -p /home/bun/.cache /app/.cache && chown -R bun:bun /home/bun /app

COPY --from=build --chown=bun:bun /app/package.json ./package.json
COPY --from=build --chown=bun:bun /app/dist/index.js ./index.js
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules

USER bun

EXPOSE 4003

ENTRYPOINT ["bun", "run", "index.js"]
