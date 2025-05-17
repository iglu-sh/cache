# Iglu Cache
The cache component of the iglu project. It's a simple nix cache implementation that takes files via the cachix client and stores them in the filesystem.
To install dependencies:
## Setup
You need a working bun installation as well as a working postgres database. It is recommended that you use the docker-compose.yml file for installation.

**IMPORTANT:** If you use the `dockder-commpose.yml` to start the service you have to build the image with `nix build .#iglu-cache-docker && docker load < result` first and then execute `docker comopse up` 

You need a .env file with at least the following variables:
- `CACHE_ROOT_DOMAIN`: The domain name of where your cache server should be available.
- `CACHE_FILESYSTEM_DIR`: The directory where the cache files should be stored (Careful, there will be a lot of read and writes happening at this dir, so choose accordingly).
- `POSTGRES_HOST`: Host of the postgresql server.
- `POSTGRES_PORT`: Port of the postgresql server.
- `POSTGRES_USER`: User of the postgresql server.
- `POSTGRES_PASSWORD`: Password for the user of the postgresql server.
- `POSTGRES_DB`: Database of the postgresql server.
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
