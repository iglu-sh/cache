# Iglu Cache
The cache component of the iglu project. It's a simple nix cache implementation that takes files via the cachix client and stores them in the filesystem.
To install dependencies:
## Setup
You need a working bun installation as well as a working postgres database. It is recommended that you use the docker-compose.yml file for installation.

You need a .env file with at least the following variables:
- `CACHE_ROOT_DOMAIN`: The domain name of where your cache server should be available.
- `CACHE_FILESYSTEM_DIR`: The directory where the cache files should be stored (Careful, there will be a lot of read and writes happening at this dir, so choose accordingly).
- `POSTGRES_CONNECTION_STRING`: The connection string to your postgres database.
```bash
bun install
bun run prod
```
This project was created using `bun init` in bun v1.2.11. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
# cache
Store paths can be pushed with
```bash
nix-store -qR ${which wget} | cachix push boerg
```