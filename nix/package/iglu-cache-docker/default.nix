{ dockerTools
, iglu
, bash
, stdenv
}:

let
  archType = if (stdenv.hostPlatform.system == "x86_64-linux") then "amd64" else "arm64";
in
dockerTools.buildImage {
  name = "iglu-cache-docker";
  tag = "v${iglu.iglu-cache.version}-${archType}";

  copyToRoot = [
    iglu.iglu-cache
    bash
  ];

  config = {
    ExposedPorts = {
      "3000/tcp" = { };
    };
    Cmd = [ "/bin/iglu-cache" ];
  };
}
