{ dockerTools 
, iglu-cache
, bash
, lib
}:

dockerTools.buildImage {
  name = "iglu-cache-docker";
  tag = "latest";

  copyToRoot = [
    iglu-cache
    bash
  ];

  config = {
    ExposedPorts = {
      "3000/tcp" = {};
    };
    Cmd = [ "/bin/iglu-cache" ];
  };
}
