{ buildBunApplication }:

buildBunApplication {
  src = ../../..;

  nodeModuleHash = "sha256-/6fla6z4OEhKd+PQFH2U821cAhlXM/6O/Ua+SE2vQTI=";

  nodeModulesToKeep = [
    "."
  ];

  extraWrapScript = ''
    if [ -z "\$CACHE_ROOT_DOMAIN" ]; then
      export CACHE_ROOT_DOMAIN="http://localhost:3000"
    fi

    if [ -z "\$POSTGRES_DB" ]; then
      export POSTGRES_DB="cache"
    fi

    if [ -z "\$POSTGRES_HOST" ]; then
      export POSTGRES_HOST="postgres"
    fi

    if [ -z "\$POSTGRES_USER" ]; then
      export POSTGRES_USER="postgres"
    fi

    if [ -z "\$POSTGRES_PASSWORD" ]; then
      export POSTGRES_PASSWORD="postgres"
    fi

    if [ -z "\$POSTGRES_PORT" ]; then
      export POSTGRES_PORT="5432"
    fi

    if [ -z "\$CACHE_FILESYSTEM_DIR" ]; then
      export CACHE_FILESYSTEM_DIR="/tmp/iglu-cache"
    fi

    if [ -z "\$CACHE_JWT_SECRET" ]; then
      export CACHE_JWT_SECRET="secret"
    fi
  '';

  bunScript = "prod";

  filesToInstall = [
    "index.ts"
    "routes"
    "utils"
  ];
}
