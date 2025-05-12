{
  description = "A very basic flake";
  nixConfig = {
  	trusted-users = ["boerg" "root"];
	extra-substituters = [
		"http://localhost:3000/boerg"
	];
	extra-trusted-public-keys = ["boerg:boerg-inc"];
  };
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }@inputs:
    let
        inherit inputs;
        inherit (nixpkgs) lib;
        pkgsDarwin = import nixpkgs {system = "aarch64-darwin";};
    in
    {
        devShells.aarch64-darwin.default = pkgsDarwin.mkShell {
            packages = with pkgsDarwin; [
                wget
            ];
        };
    };
}
