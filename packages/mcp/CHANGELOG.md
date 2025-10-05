# @coeiro-operator/mcp

## 1.0.2

### Patch Changes

- npm レジストリで破損した 1.0.1 パッケージを修正
  - 1.0.1 のパブリッシュ時に発生した integrity checksum エラーを修正
  - pnpm 移行により今後の並列パブリッシュ問題を防止
  - パッケージの再パブリッシュにより正常なバージョンを提供

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- db96813: Fix deprecation warnings by adding --no-deprecation flag to all bin scripts
- Updated dependencies [f596a2d]
  - @coeiro-operator/audio@1.0.1
  - @coeiro-operator/common@1.0.1
  - @coeiro-operator/core@1.0.1
