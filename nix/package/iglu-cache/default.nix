{ lib
, stdenv
, bun
, nodejs-slim_latest
, makeWrapper
}:

let
  inherit (packageJSON) version;
  src = ../../..;
  packageJSON = lib.importJSON "${src}/package.json";
  pname = packageJSON.name;

  nodeModules = stdenv.mkDerivation {
    pname = "${pname}_node-modules";
    inherit src version;

    nativeBuildInputs = [ bun ];
    buildInputs = [ nodejs-slim_latest ];

    dontConfigure = true;
    dontFixup = true;

    buildPhase = ''
      runHook preBuild

      export HOME=$TMPDIR

      bun install --no-progress --frozen-lockfile

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out/node_modules
      mv node_modules $out/

      runHook postInstall
    '';

    outputHash = if stdenv.isLinux then "sha256-yLSf11QbDZ09DXlAupAyhNBKDFRt4lA+Z2UH+bxaOrw=" else "";
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
  };
in
stdenv.mkDerivation rec{
  inherit src pname version;

  nativeBuildInputs = [
    nodeModules
    nodejs-slim_latest
    makeWrapper
  ];

  buildInputs = [ bun ];

  configurePhase = ''
    runHook preConfigure

    cp -a ${nodeModules}/node_modules ./node_modules
    chmod -R u+rw node_modules
    chmod -R u+x node_modules/.bin
    patchShebangs node_modules iglu-cache.sh
    
    export HOME=$TMPDIR
    export PATH="$PWD/node_modules/.bin:$PATH"

    runHook postConfigure
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/${pname}/
    mkdir $out/bin
    cp -r $src/routes $out/share/${pname}/
    cp -r $src/utils $out/share/${pname}/
    cp $src/index.ts $out/share/${pname}/
    cp -r $src/tsconfig.json $out/share/${pname}/
    cp -r $src/package.json $out/share/${pname}/

    cp $src/iglu-cache.sh $out/bin/iglu-cache

    chmod +x $out/bin/iglu-cache

    substituteInPlace $out/bin/iglu-cache \
      --replace-fail 'CWD' $out/share/iglu-cache

    runHook postInstall
  '';

  postInstall = ''
    wrapProgram $out/bin/iglu-cache \
      --prefix PATH : ${
        lib.makeBinPath[
          bun
        ]
      }
  '';
}
