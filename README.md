# pbgo - the PocketBase container runner

A simple CLI wrapper for running PocketBase in Docker with sensible defaults.

## Requirements

- Docker installed and running on your machine

## Quick Start

```bash
# Run PocketBase with default settings
npx pbgo serve

# Run with custom port
npx pbgo serve -p 9090

# Run specific PocketBase version
npx pbgo serve --use 0.29.1

# Run with custom PocketBase arguments
npx pbgo serve --dev --dir=/data/pb_data
```

## Installation

```bash
npm install -g pbgo
```

Or run directly with npx:

```bash
npx pbgo serve
```

## Usage

### Basic Commands

```bash
# Start PocketBase server (defaults to port 8090)
npx pbgo serve

# Start with custom port
npx pbgo serve -p 9090

# Use specific PocketBase version
npx pbgo serve --use 0.29.1

# Open a terminal in the container
npx pbgo term

# List available versions
npx pbgo versions

# Set default version in current directory (.pbcrc)
npx pbgo use 0.29.1
```

### Command Options

- `-p, --port <port>` - Map container port to host port (default: 8090)
- `--use <version>` - Use specific PocketBase version (default: `.pbcrc` value if present, otherwise `latest`)
- `term` - Start bash session in container instead of PocketBase
- `versions` - List all available PocketBase versions
- `use <version>` - Write `<version>` to `.pbcrc` in the current directory

### PocketBase Arguments

All arguments after the command are passed directly to PocketBase:

```bash
# Run in dev mode
npx pbgo serve --dev

# Custom data directory
npx pbgo serve --dir=/my_pb_data

# Show PocketBase version
npx pbgo --version

# Show a available Docker images
npx pbgo versions
```

## Features

- **Automatic HTTP binding**: When you run `serve`, the CLI adds `--http="0.0.0.0:8090"` if not already specified
- **Volume mounting**: Current directory is mounted to `/data` in the container
- **Multi-architecture**: Supports amd64, arm64, and arm/v7/v8 architectures
- **Version pinning**: Use `--use` to specify exact PocketBase versions
  - Persist a default version per project with `pbgo use <version>` (writes `.pbcrc`)
- **Terminal access**: Use `term` command to get a bash session in the container
- **Version listing**: Use `versions` to print available Docker tags

## Default Version with .pbcrc

You can set a default PocketBase version per project directory by creating a `.pbcrc` file that contains a Docker tag (for example, `0.29.1` or `latest`). The CLI will use this value as the default for `--use`.

```bash
# Save default version to ./.pbcrc
npx pbgo use 0.29.1

# Subsequent runs default to that version
npx pbgo serve

# Override the default for a single run
npx pbgo serve --use latest
```

## Docker Image

This CLI uses the `benallfree/pocketbase` Docker image which provides:

- Multi-architecture support (amd64, arm64, arm/v7/v8)
- Alpine Linux base for small size
- Pre-built PocketBase binaries
- Volume mounting for persistent data

## Version Tags

Available Docker image tags:

- `latest` - Latest PocketBase version
- `X.Y.Z` - Specific version (e.g., `0.29.1`)
- `X.Y` - Latest patch of minor version (e.g., `0.29`)

## Docker Registry

Images are published to the Docker registry [benallfree/pocketbase](https://hub.docker.com/repository/docker/benallfree/pocketbase/general):

- **latest**: Tracks the newest stable PocketBase release
- **minor tags**: `X.Y` tags (e.g., `0.29`) always point to the latest patch of that minor line
- **full semver**: `X.Y.Z` tags for specific versions (e.g., `0.29.1`)

You can reference any of these with `--use` or set a default via `.pbcrc`.

## Supported Versions

The following versions are currently supported by the registry and CLI:

```text
Available PocketBase versions:
  latest
  0.29
  0.29.1
  0.28
  0.28.4
  0.27
  0.27.2
  0.26
  0.26.6
  0.25
  0.25.9
  0.24
  0.24.4
  0.23
  0.23.12
  0.22
  0.22.34
  0.21
  0.21.3
  0.20
  0.20.7
  0.19
  0.19.4
  0.18
  0.18.10
  0.17
  0.17.7
  0.16
  0.16.10
  0.15
  0.15.3
  0.14
  0.14.5
  0.13
  0.13.4
  0.12
  0.12.3
  0.11
  0.11.4
  0.10
  0.10.4
  0.9
  0.9.2
  0.8
  0.8.0
  0.7
  0.7.10
  0.6
  0.6.0
  0.5
  0.5.2
  0.4
  0.4.2
  0.3
  0.3.4
```
