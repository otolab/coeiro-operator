#!/bin/bash
# シミュレーション: 1.3.0が3つ、1.3.1が1つ
versions="1.3.0
1.3.0
1.3.0
1.3.1
1.2.0
1.0.2"

HIGHEST_VERSION=""
for VERSION in $versions; do
  if [ -z "$HIGHEST_VERSION" ] || [ "$(printf '%s\n' "$HIGHEST_VERSION" "$VERSION" | sort -V | tail -n1)" = "$VERSION" ]; then
    HIGHEST_VERSION="$VERSION"
  fi
done

echo "最大バージョン: $HIGHEST_VERSION"
