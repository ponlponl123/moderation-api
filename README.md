# moderation-api

[![CI/CD Pipeline](https://github.com/ponlponl123/moderation-api/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ponlponl123/moderation-api/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.3+-black.svg?logo=bun)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-v4-E36002.svg?logo=hono)](https://hono.dev)

Ultra-lightweight, zero-warmup, hyper-performance text and image safety moderation microservice. Engineered specifically for resource-constrained **"potato servers"** (1 vCPU, 1 GB RAM) and air-gapped laboratory research environments.

---

## Content Moderation & Research Disclaimer

> [!IMPORTANT]
> The anchor vectors, deterministic regular expression patterns, and test lexicons packaged in this repository contain explicit, offensive, sexually suggestive, and sensitive terms. These exist **strictly for the engineering purpose of automated defensive content moderation, semantic vector filtering, and safety benchmark controls**.
>
> They do not represent the personal views, opinions, or endorsement of the creators, maintainers, or hosting laboratory.

---

## Architectural Highlights

- **2-Tier Dual Engine**:
  - **Tier 0 Fast Path**: Deterministic regular expression lexicon evaluation (<0.2ms overhead, 0% CPU consumption).
  - **Tier 1 Vector Embedding & Classification**: Multilingual ONNX Transformer pipelines for contextual semantic scoring.
- **5-Class Image Safety Ratios**: Quantifies visual content across `drawings`, `hentai`, `neutral`, `porn`, and `sexy`.
- **4-Class Multilingual Text Ratios**: Quantifies textual content across `nsfw`, `toxic`, `violence`, and `neutral`.
- **Potato Server Invariants (1 vCPU / 1 GB RAM)**:
  - **Thread Starvation Prevention**: Strict `intraOpNumThreads: 1` and `interOpNumThreads: 1` limits.
  - **Serialized Inference Queue**: Serializes ONNX forward passes to prevent CPU thrashing under concurrent load.
  - **In-Flight Request Deduplication**: Reuses concurrent identical requests across text and image pipelines.
  - **Zero-Copy Batched Embeddings**: Subarray buffer slicing (`embs.data.subarray`) executes N clause evaluations in a single model forward pass.
  - **Lazy Initialization**: Models are initialized solely on their first request per modality (boot memory footprint ~35MB).
  - **Quantization**: `q8` (int8) ONNX runtime quantization decreases weight memory footprint by >70%.
  - **Memory Hygiene**: Automatic `Bun.gc(true)` triggers post heavy image classification.
- **Two-Tier Cache**: In-memory LRU + Redis (Standalone / Sentinel with auto-failover) keyed by SHA-256 with 7-day TTL.

---

## Lab & Self-Hosting Guide

### 1. Hardware Requirements
| Metric | Minimum (Potato) | Recommended |
|---|---|---|
| **CPU** | 1 vCPU (x86_64 or arm64) | 2+ vCPUs |
| **RAM** | 512 MB (idle: ~35MB, peak: ~220MB) | 1 GB - 2 GB |
| **Disk** | 500 MB (includes ONNX weight cache) | 1 GB |
| **Runtime** | Bun >= 1.2 or Docker | Docker Compose |

---

### 2. Air-Gapped & Offline Deployment
In secure lab networks without outbound Internet access, models can be pre-cached into the local cache directory:

```bash
# Set model cache target
export HF_HOME="./.cache"
export TRANSFORMERS_CACHE="./.cache"

# Pre-fetch weights on an internet-connected workstation:
bun run src/index.ts &
PID=$!
sleep 2
# Warm up text & image pipelines to cache ONNX weights locally
curl -X POST http://localhost:4003/v1/moderate/text -H "Content-Type: application/json" -d '{"text":"warmup"}'
curl -X POST http://localhost:4003/v1/moderate/image -H "Content-Type: application/json" -d '{"imageUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}'
kill $PID

# Copy .cache/ directory directly to your air-gapped lab server
scp -r .cache user@lab-server:/opt/moderation-api/.cache
```

---

### 3. Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/ponlponl123/moderation-api.git
cd moderation-api

# 2. Configure environment
cp .env.example .env.development.local

# 3. Install dependencies
bun install --frozen-lockfile

# 4. Start hot-reloading development server
bun run dev

# 5. Run test suite
bun test
```

---

### 4. Standalone Binary Compilation
Compile a zero-dependency standalone binary for Linux or Windows:

```bash
# Linux x64
bun build src/index.ts --compile --minify --target=bun-linux-x64 --outfile dist/moderation-api-linux-x64

# Windows x64
bun build src/index.ts --compile --minify --target=bun-windows-x64 --outfile dist/moderation-api-windows-x64.exe
```

---

### 5. Production Docker Deployment

#### Using Docker Compose (Single Container)
```yaml
services:
  moderation-api:
    image: ghcr.io/ponlponl123/moderation-api:latest
    ports:
      - "4003:4003"
    environment:
      - PORT=4003
      - NODE_ENV=production
      - LOGGING=traffic
      - MODERATION_CPU_THREADS=1
      - REDIS_ENABLED=false
    volumes:
      - hf-cache:/home/bun/.cache
    restart: unless-stopped

volumes:
  hf-cache:
```

Launch with:
```bash
docker compose up -d
```

#### Multi-Node Cluster with Redis Sentinel
```yaml
services:
  moderation-api:
    image: ghcr.io/ponlponl123/moderation-api:latest
    ports:
      - "4003:4003"
    environment:
      - PORT=4003
      - NODE_ENV=production
      - REDIS_ENABLED=true
      - REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
      - REDIS_SENTINEL_NAME=mymaster
      - REDIS_PASSWORD=secret
    restart: always
```

---

## API Reference

### 1. Unified Moderation (`POST /v1/moderate`)
Moderates text, image (remote URL, base64, or multipart), or both simultaneously in one round-trip.

**Request:**
```bash
curl -X POST http://localhost:4003/v1/moderate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello everyone, hope you enjoy the research seminar!",
    "imageUrl": "https://example.com/avatar.jpg"
  }'
```

**Response (`200 OK`):**
```json
{
  "flagged": false,
  "text": {
    "flagged": false,
    "score": 0.0821,
    "engine": "multilingual-minilm",
    "ratios": {
      "nsfw": 0.0412,
      "toxic": 0.0821,
      "violence": 0.0215,
      "neutral": 0.9179
    },
    "cached": false,
    "durationMs": 8.12
  },
  "image": {
    "flagged": false,
    "score": 0.0124,
    "engine": "nsfw-image-detector-onnx",
    "ratios": {
      "drawings": 0.0211,
      "hentai": 0.0012,
      "neutral": 0.9782,
      "porn": 0.0051,
      "sexy": 0.0084
    },
    "cached": false,
    "durationMs": 42.15
  },
  "durationMs": 50.32
}
```

---

### 2. Text Moderation (`POST /v1/moderate/text`)
Accepts JSON `{ "text": "..." }` or raw `text/plain` payloads. Supports multilingual analysis (English, Thai, Japanese, Chinese, etc.).

**Request:**
```bash
curl -X POST http://localhost:4003/v1/moderate/text \
  -H "Content-Type: application/json" \
  -d '{"text": "get lost idiot"}'
```

**Response (`200 OK`):**
```json
{
  "flagged": true,
  "score": 1.0,
  "engine": "lexicon",
  "category": "harassment",
  "reason": "Harassment or toxic conduct detected via lexicon",
  "ratios": {
    "nsfw": 0.0,
    "toxic": 1.0,
    "violence": 0.0,
    "neutral": 0.0
  },
  "durationMs": 0.18
}
```

---

### 3. Image Moderation (`POST /v1/moderate/image`)
Accepts `multipart/form-data` uploads, JSON `{ "image": "data:image/jpeg;base64,..." }`, JSON `{ "imageUrl": "https://..." }`, or raw binary buffers.

**Request (Multipart Form Upload):**
```bash
curl -X POST http://localhost:4003/v1/moderate/image \
  -F "file=@sample.png"
```

**Response (`200 OK`):**
```json
{
  "flagged": true,
  "score": 0.8842,
  "engine": "nsfw-image-detector-onnx",
  "category": "hentai",
  "reason": "Sexually explicit illustrated or animated content",
  "ratios": {
    "drawings": 0.1245,
    "hentai": 0.8842,
    "neutral": 0.0412,
    "porn": 0.0152,
    "sexy": 0.0351
  },
  "cached": false,
  "durationMs": 64.30
}
```

---

### 4. Health & Resource Monitoring (`GET /health`)
Returns real-time memory metrics (RSS, Heap), pipeline initialization states, and Redis cluster connectivity.

```bash
curl http://localhost:4003/health
```

```json
{
  "status": "ok",
  "uptimeSec": 1240,
  "modelsLoaded": {
    "text": true,
    "image": false
  },
  "redis": {
    "enabled": false,
    "status": "disabled"
  },
  "memory": {
    "rssMb": 94.21,
    "heapUsedMb": 38.45,
    "heapTotalMb": 52.10
  }
}
```

---

### 5. Service Root Information (`GET /`)
Returns runtime service version, research disclaimer, available routes, and active configuration limits.

---

## Benchmark & Performance

Tested on a **1 vCPU / 1 GB RAM cloud instance (AMD EPYC 7763)**:

| Operation | Engine / Pipeline | Latency | Peak Memory |
|---|---|---|---|
| **Tier 0 Text Lexicon Hit** | Deterministic Regex | `0.18 ms` | +0 MB |
| **Tier 1 Text Semantic Embedding** | `paraphrase-multilingual-MiniLM-L12-v2` (q8) | `6.80 ms` | ~120 MB RSS |
| **Tier 1 Image Classification** | `nsfw-image-detector-ONNX` (q8 ViT) | `45.20 ms` | ~185 MB RSS |
| **Cache Hit (Memory / Redis)** | SHA-256 Lookup | `0.12 ms` | +0 MB |
| **Cold Boot Idle Footprint** | Bun Runtime | `2.40 ms` | ~34 MB RSS |

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4003` | HTTP service listening port |
| `API_KEY` | *(empty)* | Optional Bearer / `x-api-key` authorization token |
| `LOGGING` | `traffic` | Logging format (`compact`, `verbose`, `traffic`, `none`) |
| `MODERATION_CPU_THREADS` | `1` | Strict intra/inter ONNX thread limit (avoids core starvation) |
| `MODERATION_TEXT_THRESHOLD` | `0.45` | Cosine similarity threshold for flagging text |
| `MODERATION_PORN_THRESHOLD` | `0.40` | Porn probability threshold for flagging image |
| `MODERATION_HENTAI_THRESHOLD`| `0.40` | Hentai probability threshold for flagging image |
| `MODERATION_SEXY_THRESHOLD` | `0.60` | Suggestive/sexy probability threshold |
| `MODERATION_IMAGE_THRESHOLD`| `0.50` | Composite NSFW image probability threshold |
| `MODERATION_CACHE_TTL_SEC` | `604800` | In-memory LRU and Redis cache TTL (7 days default) |
| `IMAGE_MODEL` | `onnx-community/nsfw-image-detector-ONNX` | Hugging Face ONNX image model ID |
| `TEXT_MODEL` | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | Hugging Face ONNX text embedding model ID |
| `REDIS_ENABLED` | `false` | Enable distributed Redis / Sentinel caching |
| `REDIS_HOST` | `127.0.0.1` | Standalone Redis host |
| `REDIS_PORT` | `6379` | Standalone Redis port |
| `REDIS_SENTINEL_HOSTS` | *(empty)* | Comma-separated Sentinel nodes (`host1:26379,host2:26379`) |
| `REDIS_SENTINEL_NAME` | `mymaster` | Sentinel master group name |
| `REDIS_PASSWORD` | *(empty)* | Redis / Sentinel authentication password |

---

## Client Integration Examples

### Node.js / Bun / Browser (TypeScript)
```typescript
interface ModerationResponse {
  flagged: boolean;
  score: number;
  ratios: Record<string, number>;
  reason?: string;
}

export async function moderateContent(text?: string, imageUrl?: string): Promise<boolean> {
  const res = await fetch("http://localhost:4003/v1/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, imageUrl }),
  });
  const data = await res.json();
  return data.flagged;
}
```

### Python
```python
import requests

def check_text(prompt: str) -> dict:
    resp = requests.post(
        "http://localhost:4003/v1/moderate/text",
        json={"text": prompt}
    )
    resp.raise_for_status()
    return resp.json()
```

---

## License
MIT © [ponlponl123](https://github.com/ponlponl123)
