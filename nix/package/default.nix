final: prev: {
  iglu-cache = prev.callPackage ./package.nix {};
  iglu-cache-docker = prev.callPackage ./docker.nix {};
}

