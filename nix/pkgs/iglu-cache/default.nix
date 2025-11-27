{ bun2nix }:

bun2nix.writeBunApplication {
  packageJson = ../../../package.json;
  src = ../../..;

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  dontUseBunBuild = true;

  startScript = "bun run prod";

  filesToInstall = [
    "index.ts"
    "routes"
    "utils"
  ];
}
