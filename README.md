# cachix-knockoff

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.11. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
# cache
Store paths can be pushed with
```bash
nix-store -qR ${which wget} | cachix push boerg
```