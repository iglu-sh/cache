FROM nixos/nix
RUN nix-channel --update
RUN nix-env -iA nixpkgs.bun
WORKDIR /cache
COPY . /cache
RUN bun install
EXPOSE 3000
CMD ["bun", "run", "prod"]