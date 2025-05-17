#!/usr/bin/env bash
for system in x86_64-linux aarch64-linux; do
  nix build .#packages.$system.iglu-cache-docker
  docker load < result

  version=$(docker images | grep iglu-cache-docker | head -n1 | awk '{print $2}' | cut -d- -f1)

  echo "version=$version" >> $GITHUB_OUTPUT
done

for tag in latest $version; do
  docker manifest create iglu-api/iglu-cache-docker:$tag \
    localhost/iglu-api/iglu-cache-docker:$version-amd64 \
    localhost/iglu-api/iglu-cache-docker:$version-arm64
  docker manifest annotate iglu-api/iglu-cache-docker:$tag \
    localhost/iglu-api/iglu-cache-docker:$version-arm64 --arch arm64
  docker manifest annotate iglu-api/iglu-cache-docker \
    localhost/iglu-api/iglu-cache-docker:$version-amd64 --arch amd64
done
