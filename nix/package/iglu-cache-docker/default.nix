{ dockerTools
, iglu
, bash
}:

dockerTools.buildImage {
  name = "iglu-cache-docker";
  tag = "v${iglu.iglu-cache.version}";

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
