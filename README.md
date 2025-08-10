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
| `--dir <dir>`                     |       | `./pb_data`           | Host data directory mounted to `/pb/pb_data` in the container.                                                                                                       |
| `--hooksDir <hooksDir>`           |       | `./pb_hooks`          | Host hooks directory mounted to `/pb/pb_hooks`.                                                                                                                      |
| `--publicDir <publicDir>`         |       | `./pb_public`         | Host public directory mounted to `/pb/pb_public`.                                                                                                                    |
| `--migrationsDir <migrationsDir>` |       | `./pb_migrations`     | Host migrations directory mounted to `/pb/pb_migrations`.                                                                                                            |
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

## Container filesystem and mounts

- **Working dir**: `/app` is the main directory and PocketBase runs with this as the CWD.
- **Host CWD bind**: Your host current working directory is bind-mounted to `/app`.
- **PocketBase special dirs**: Each is mounted separately, so they can live anywhere on host:
  - Host `pb_data` → container `/pb/pb_data`
  - Host `pb_hooks` → container `/pb/pb_hooks`
  - Host `pb_public` → container `/pb/pb_public`
  - Host `pb_migrations` → container `/pb/pb_migrations`
    By default, these directories are resolved relative to your host CWD unless overridden via options.

## Bun and node_modules support

- If a `package.json` exists in your host CWD, the container will automatically run `bun i` on startup.
- The Bun install cache inside the container is `/.bun_cache`, which is bind-mounted to:
  - The host Bun cache directory from `bun pm cache`, if available, otherwise
  - `<cwd>/.pbgo/bun` (created if missing)
- With a warm cache, running `bun i` on startup adds almost no startup time.
- Parent `node_modules` outside your project are not visible inside the container; ensure your `package.json` declares all needed dependencies.

## Runtime detection (Podman preferred)

- The runtime is auto-detected: Podman if available, otherwise Docker. If neither is found, the CLI throws.
- If Podman is installed, it's assumed preferred over Docker.

## Ports and auto-selection

- Use `--http 0.0.0.0:0` (or `--http 0`) to request an ephemeral host port. The CLI will find a free port and map it to the container's `8090`.
- Output URLs are rewritten to your selected host/port when `--verbose` is enabled.

## Programmatic API

You can use selected utilities from code:

```ts
import { findAvailablePort } from 'pbgo'

const port = await findAvailablePort() // returns an available TCP port number on the host
```

### Building a container command with `pbgo()`

`pbgo(options)` returns `{ command, args }` that you can pass to `spawn` (or similar). It auto-detects the runtime, mounts your host CWD to `/app`, binds Bun cache to `/.bun_cache`, and maps PocketBase special dirs to `/pb/*`.

Minimal example:

```ts
import { spawn } from 'node:child_process'
import { pbgo, findAvailablePort, createUrlReplacer } from 'pbgo'

const port = await findAvailablePort()
const host = '0.0.0.0'

const { command, args } = pbgo({
  host,
  port,
  use: 'latest',
  args: ['serve', '--dev'], // forwarded to PocketBase
  verbose: true,
})

const child = spawn(command, args, { shell: true })
child.stdout?.pipe(createUrlReplacer(host, port)).pipe(process.stdout)
child.stderr?.pipe(createUrlReplacer(host, port)).pipe(process.stderr)
```

Notes:

- If `args` contains `serve`, the container is forced to bind to `0.0.0.0:8090` internally; host/port mapping is handled via `-p host:port:8090`.
- You can override mounts via `dir`, `hooksDir`, `publicDir`, `migrationsDir`, or `binds`.

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
