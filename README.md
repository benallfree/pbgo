# pbgo - the PocketBase container runner

A simple CLI wrapper for running PocketBase in Docker or Podman with sensible defaults.

## Requirements

- Docker or Podman installed and available on your PATH

## Quick Start

```bash
# Run PocketBase with default settings
npx pbgo serve

# Run with custom port
npx pbgo --http 0.0.0.0:9090 serve

# Run specific PocketBase version
npx pbgo --use 0.29.1

# Run with custom PocketBase arguments
npx pbgo serve --dev --dir=/data/pb_data
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

### Forwarded to PocketBase (default)

All non-subcommand invocations forward arguments directly to PocketBase.

```bash
# Start PocketBase (defaults to port 8090)
npx pbgo serve

# With custom port
npx pbgo --http 0.0.0.0:9090 serve

# Run in dev mode
npx pbgo serve --dev

# Use a specific PocketBase version
npx pbgo --use 0.29.1
```

Notes:

- When you include `serve`, the CLI ensures PocketBase binds to `0.0.0.0:8090` unless overridden by `--http`.
- Any extra flags not recognized by `pbgo` are passed through to PocketBase unchanged.

### term

Open an interactive shell inside the container.

```bash
npx pbgo term
```

### use <version>

Persist a default version to `.pbgorc` in the current directory.

```bash
npx pbgo use 0.29.1
```

### versions

List available Docker tags for `benallfree/pocketbase`.

```bash
npx pbgo versions
```

## Options

| Option                            | Alias | Default               | Description                                                                                                                                                          |
| --------------------------------- | ----- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--http <address>`                |       | `0.0.0.0:8090`        | Host bind address for the container port 8090. Use `0` or `0.0.0.0:0` to auto-select a free port. When using `serve`, pbgo ensures PocketBase binds to this address. |
| `--use <version>`                 | `-u`  | `.pbgorc` or `latest` | Docker tag of `benallfree/pocketbase` to run. Accepts `latest`, `X.Y`, or `X.Y.Z`.                                                                                   |
| `--runtime <runtime>`             | `-r`  | auto / `.pbgorc`      | Container runtime: `podman` or `docker`. Auto-detect prefers Podman if available.                                                                                    |
| `--dir <dir>`                     |       | `./pb_data`           | Host data directory mounted to `/data/pb_data` in the container.                                                                                                     |
| `--hooksDir <hooksDir>`           |       | `./pb_hooks`          | Host hooks directory mounted to `/data/pb_hooks`.                                                                                                                    |
| `--publicDir <publicDir>`         |       | `./pb_public`         | Host public directory mounted to `/data/pb_public`.                                                                                                                  |
| `--migrationsDir <migrationsDir>` |       | `./pb_migrations`     | Host migrations directory mounted to `/data/pb_migrations`.                                                                                                          |
| `--version`                       | `-v`  |                       | Prints `pbgo` version and the PocketBase version reported by the container for the selected tag.                                                                     |
| `--verbose`                       |       |                       | Prints the assembled container command and rewrites output URLs to your chosen host/port.                                                                            |

## Project Config with .pbgorc

You can set a default PocketBase version per project directory by creating a `.pbgorc` file that contains JSON (for example, `{"version":"0.29.1"}` or `{"version":"latest"}`). The CLI will use this value as the default for `--use`. You can also specify a default runtime here.

```bash
# Save default version to ./.pbgorc
npx pbgo use 0.29.1

# Subsequent runs default to that version
npx pbgo

# Override the default version for a single run
npx pbgo --use latest

# Choose runtime explicitly for a run
npx pbgo --runtime podman
```

### .pbgorc example

```json
{
  "version": "0.29.1",
  "runtime": "podman"
}
```

## Docker Image & Registry

This CLI uses the [benallfree/pocketbase](https://hub.docker.com/repository/docker/benallfree/pocketbase) Docker image, which provides:

- Multi-architecture support (amd64, arm64, arm/v7/v8)
- Alpine Linux base for small size
- Pre-built PocketBase binaries
- Volume mounting for persistent data

Images are published to the Docker registry [benallfree/pocketbase](https://hub.docker.com/repository/docker/benallfree/pocketbase/general):

- **latest**: Tracks the newest stable PocketBase release
- **minor tags**: `X.Y` tags (e.g., `0.29`) always point to the latest patch of that minor line
- **full semver**: `X.Y.Z` tags for specific versions (e.g., `0.29.1`)

You can reference any of these with `--use` or set a default via `.pbgorc`.

## Version Tags

The following versions are currently supported by the registry and CLI:

Available PocketBase versions:

```
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
