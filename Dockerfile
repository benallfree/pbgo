# Build stage
FROM alpine AS builder

RUN apk add --no-cache curl unzip

ARG TARGETARCH  
ARG POCKETBASE_VERSION=0.29.1

# POCKETBASE_START
# Map Docker arch names to PocketBase release names
RUN case ${TARGETARCH} in \
        amd64) POCKETBASE_ARCH="amd64" ;; \
        arm64) POCKETBASE_ARCH="arm64" ;; \
        arm) POCKETBASE_ARCH="armv7" ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    echo "Downloading PocketBase ${POCKETBASE_VERSION} for linux_${POCKETBASE_ARCH}" && \
    curl -fsSL https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${POCKETBASE_ARCH}.zip -o /tmp/pocketbase.zip && \
    unzip /tmp/pocketbase.zip -d /tmp/pocketbase
# POCKETBASE_END

# Runtime stage
FROM oven/bun:alpine

RUN apk add --no-cache ca-certificates bash

# Copy just the pocketbase binary from build stage
COPY --from=builder /tmp/pocketbase/pocketbase /usr/local/bin/pocketbase

RUN mkdir -p /pb /app

ENV BUN_INSTALL_CACHE_DIR=/app/.pbgo_cache

WORKDIR /app

# Copy source code
COPY . .

# Create entrypoint script in /usr/local/bin so it won't be overwritten by volume mounts
RUN cat > /usr/local/bin/entrypoint.sh << 'EOF'
#!/bin/bash
bun i
exec "$@"
EOF
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8090

# trigger build

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["echo", "hello"]