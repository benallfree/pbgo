# pbgo - the PocketBase container runner

A simple CLI wrapper for running PocketBase in Docker or Podman with sensible defaults.

## Requirements

- Docker or Podman installed and available on your PATH

## Quick Start

```bash
# Run PocketBase with default settings
npx pbgo

# Run with custom port
npx pbgo --http 0.0.0.0:9090

# Run specific PocketBase version
npx pbgo --use 0.29.1

# Run with custom PocketBase arguments
npx pbgo --dev --dir=/data/pb_data
```

## Installation

```bash
npm install -g pbgo
```

Or run directly with npx:

```bash
npx pbgo
```

## Usage

### Basic Commands

```bash
# Start PocketBase server (defaults to port 8090)
npx pbgo serve

# Start with custom port
npx pbgo --http 0.0.0.0:9090

# Use specific PocketBase version
npx pbgo --use 0.29.1

# Open a terminal in the container
npx pbgo term

# List available versions
npx pbgo versions

# Set default version in current directory (.pbgorc)
npx pbgo use 0.29.1
```

### Command Options

- `--http <address>` - HTTP server address (default: 0.0.0.0:8090)
- `--use <version>` or `-u <version>` - Use specific PocketBase version (default: `.pbgorc` value if present, otherwise `latest`)
- `--term` or `-t` - Run in terminal mode
- `--provider <provider>` or `-r <provider>` - Select container provider: `podman` or `docker`
- `--dir <dir>` - PocketBase data directory (default: `<cwd>/pb_data`)
- `--hooksDir <hooksDir>` - PocketBase hooks directory
- `--publicDir <publicDir>` - PocketBase public directory
- `--migrationsDir <migrationsDir>` - PocketBase migrations directory
- `--version` or `-v` - Display version information

All other arguments are passed directly to PocketBase unchanged.

### PocketBase Arguments

All arguments after the command are passed directly to PocketBase:

```bash
# Run in dev mode
npx pbgo --dev

# Custom data directory
npx pbgo --dir=/my_pb_data

# Show PocketBase version
npx pbgo --version

# Show available Docker images
npx pbgo versions
```

## Features

- **Automatic HTTP binding**: When you run `serve`, the CLI adds `--http="0.0.0.0:8090"` if not already specified
- **Volume mounting**: Automatically mounts PocketBase directories:
  - `pb_data` - Data directory (default: `<cwd>/pb_data`)
  - `pb_hooks` - Hooks directory (default: `<parent>/pb_hooks`)
  - `pb_public` - Public directory (default: `<parent>/pb_public`)
  - `pb_migrations` - Migrations directory (default: `<parent>/pb_migrations`)
- **Multi-architecture**: Supports amd64, arm64, and arm/v7/v8 architectures
- **Version pinning**: Use `--use` to specify exact PocketBase versions
  - Persist a default version per project with `pbgo use <version>` (writes `.pbgorc`)
- **Terminal access**: Use `term` command to get a bash session in the container
- **Version listing**: Use `versions` to print available Docker tags
- **Docker and Podman**: Works with either provider. Choose via `--provider`, `.pbgorc`, or auto-detection

## Provider Selection (Docker/Podman)

Precedence:

1. `--provider <podman|docker>` (CLI flag)
2. `.pbgorc` in the current directory (`{"provider":"podman"}` or `"docker"`)
3. Auto-detect: prefers Podman if available, otherwise Docker

If the chosen provider is not available on PATH, the CLI exits with an error.

## Project Config with .pbgorc

You can set a default PocketBase version per project directory by creating a `.pbgorc` file that contains JSON (for example, `{"version":"0.29.1"}` or `{"version":"latest"}`). The CLI will use this value as the default for `--use`. You can also specify a default provider here.

```bash
# Save default version to ./.pbgorc
npx pbgo use 0.29.1

# Subsequent runs default to that version
npx pbgo

# Override the default version for a single run
npx pbgo --use latest

# Choose provider explicitly for a run
npx pbgo --provider podman
```

### .pbgorc example

```json
{
  "version": "0.29.1",
  "provider": "podman"
}
```

## Directory Structure

The CLI automatically creates and manages PocketBase directories:

```
your-project/
├── .pbgorc                    # Configuration file
├── pb_data/                   # PocketBase data (created automatically)
├── pb_hooks/                  # PocketBase hooks (created automatically)
├── pb_public/                 # PocketBase public files (created automatically)
└── pb_migrations/             # PocketBase migrations (created automatically)
```

You can override any of these directories using the respective CLI options:

- `--dir` for data directory
- `--hooksDir` for hooks directory
- `--publicDir` for public directory
- `--migrationsDir` for migrations directory

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

You can reference any of these with `--use` or set a default via `.pbgorc`.

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
