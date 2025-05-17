#!/usr/bin/env bash
  version=$(cat package.json | grep version | awk '{print $2}' | cut -d'"' -f 2)
  echo "version=$version" >> $GITHUB_OUTPUT
  for tag in $version latest; do
    docker pull ghcr.io/iglu-api/iglu-cache-docker:$tag-arm64
    docker pull ghcr.io/iglu-api/iglu-cache-docker:$tag-amd64
    docker manifest create ghcr.io/iglu-api/iglu-cache-docker:$tag \
      ghcr.io/iglu-api/iglu-cache-docker:$tag-amd64 \
      ghcr.io/iglu-api/iglu-cache-docker:$tag-arm64
    docker manifest annotate ghcr.io/iglu-api/iglu-cache-docker:$tag \
      ghcr.io/iglu-api/iglu-cache-docker:$tag-arm64 --arch arm64
    docker manifest annotate ghcr.io/iglu-api/iglu-cache-docker \
      ghcr.io/iglu-api/iglu-cache-docker:$tag-amd64 --arch amd64
  done
