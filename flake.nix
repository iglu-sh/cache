{
  description = "A very basic flake";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    utils.url = "github:gytis-ivaskevicius/flake-utils-plus?ref=afcb15b845e74ac5e998358709b2b5fe42a948d1";

    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  # deadnix: skip
  outputs = inputs@{ self, nixpkgs, utils, bun2nix }:
    utils.lib.mkFlake {
      inherit self inputs;

      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      overlay = import ./nix/pkgs;

      sharedOverlays = [
        inputs.bun2nix.overlays.default
        self.overlay
      ];

      outputsBuilder = channels:
        let
          inherit (channels) nixpkgs;
        in
        {
          devShell = nixpkgs.mkShell {
            packages = with nixpkgs; [
              zsh
              wget
              cachix
              bun
              iglu.flakecheck
            ];
            shellHook = ''
              exec zsh
            '';
          };
          packages = nixpkgs.iglu;
        };
    };
}
