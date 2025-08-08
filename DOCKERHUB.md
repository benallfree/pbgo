# PocketBase Docker Images

Multi-architecture Docker images for [PocketBase](https://pocketbase.io/) - the open source backend in 1 file.

## Quick Start

```bash
# Run the latest version
docker run -p 8090:8090 benallfree/pocketbase:latest

# With persistent data
docker run -p 8090:8090 -v pocketbase_data:/data benallfree/pocketbase:latest pocketbase  --dir=/data/pb_data

# Run migrations instead of server
docker run -v pocketbase_data:/data benallfree/pocketbase:latest \
  pocketbase migrate --dir=/data/pb_data

# Custom serve command with different port
docker run -p 9090:9090 -v pocketbase_data:/data benallfree/pocketbase:latest \
  pocketbase serve --http=0.0.0.0:9090 --dev --dir=/data/pb_data

# Run with custom config
docker run -p 8090:8090 -v pocketbase_data:/data benallfree/pocketbase:latest \
  pocketbase serve --http=0.0.0.0:8090 --publicDir=/data/public --dir=/data/pb_data
```

Access PocketBase at:

- **API**: http://localhost:8090/api/
- **Admin UI**: http://localhost:8090/\_/

## Available Tags

### Version Pinning Options

We provide multiple tagging strategies for different use cases:

| Tag Format | Example                        | Description                   | Use Case                   |
| ---------- | ------------------------------ | ----------------------------- | -------------------------- |
| `latest`   | `benallfree/pocketbase:latest` | Newest version                | Quick testing, development |
| `X.Y.Z`    | `benallfree/pocketbase:0.29.1` | Exact version                 | Production (never changes) |
| `X.Y`      | `benallfree/pocketbase:0.29`   | Latest patch of minor version | Auto patch updates         |

### Examples

```bash
# Always get the latest PocketBase
docker run benallfree/pocketbase:latest

# Pin to exact version (recommended for production)
docker run benallfree/pocketbase:0.29.1

# Auto-update to latest patches in 0.29.x series
docker run benallfree/pocketbase:0.29
```

## Architecture Support

These images support multiple architectures:

- **linux/amd64** - Intel/AMD 64-bit
- **linux/arm64** - ARM 64-bit (Apple Silicon, modern ARM servers)
- **linux/arm/v8** - ARMv8 64-bit (modern ARM devices)
- **linux/arm/v7** - ARMv7 32-bit (Raspberry Pi, older ARM devices)

Docker automatically pulls the correct image for your platform.

## Environment Variables

| Variable            | Description                 | Example                            |
| ------------------- | --------------------------- | ---------------------------------- |
| `PB_ENCRYPTION_KEY` | 32-character encryption key | `your-32-char-encryption-key-here` |

## Health Checks

```bash
# Check if PocketBase is running
curl http://localhost:8090/api/health

# View logs
docker logs pocketbase
```
