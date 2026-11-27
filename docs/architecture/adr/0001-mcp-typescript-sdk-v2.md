# ADR-0001: MCP TypeScript SDK v2 への移行方針

- Status: Proposed
- Date: 2026-11-27
- Issue: [#248](https://github.com/otolab/coeiro-operator/issues/248)

## Context

Issue #248 は、`@modelcontextprotocol/sdk` v1 から公式 TypeScript SDK v2 への移行を扱う。v2 は 2026-07-27 に安定版として公開され、サーバーとクライアントの package が分割された。公式 v1.x は v2 公開後少なくとも 6 か月、バグ修正とセキュリティ更新を受けるが、保守終了日は明示されていない。最低保証期間は 2027-01-27 頃までとなる。

現行リポジトリでは、`@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` が SDK v1.32.2 と Zod 3.25.76 に依存している。MCP 本体はツールを登録し、stdio transport で起動する。ユーザーガイドの resource 登録には v1 の `resource()` を使っている。mcp-debug のテスト用 echo server も SDK の server API を使う一方、debug client は JSON-RPC を直接扱う独自実装であり、SDK の client API は使っていない。

公式 v2 の移行資料から、次の互換性条件が分かった。

- v2 は Node.js 20 以上を必要とする。ツールや resource の schema には Standard Schema が必要で、Zod を使う場合は 4.2.0 以上が公式の推奨条件となる。Zod 3 の schema は v2 で利用できない。
- package は `@modelcontextprotocol/server` などに分割された。stdio transport は `@modelcontextprotocol/server/stdio` から読み込む。
- `resource()` は v2 で削除され、`registerResource()` に置き換わる。ツール登録では `registerTool()` と明示的な config object を使う。
- `server.connect(new StdioServerTransport())` は v2 でも利用できる。新しい 2026-07-28 protocol revision を提供する場合は `serveStdio()` への切り替えが必要となる。
- `tools/list` が返す JSON Schema は v1 と同じ形にはならない。v2 は JSON Schema 2020-12 を使い、`additionalProperties` の出力なども変わる。
- v2 は未登録 tool の呼び出しを JSON-RPC `-32602` エラーとして返す。v1 で確認されている `isError: true` の tool result とは応答形式が異なる。

参照した公式資料:

- [MCP TypeScript SDK README](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/README.md)
- [SDK ROADMAP](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/ROADMAP.md)
- [v1 から v2 への移行ガイド](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)
- [v2 の package 構成](https://ts.sdk.modelcontextprotocol.io/v2/get-started/packages)
- [stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)

## Decision

1. **SDK v2 へ移行する。** 移行は `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` をまとめた一つの実装 PR で行い、両 package に各々が使う公式 v2 package を依存として宣言する。SDK の client package は追加しない。mcp-debug の独自 JSON-RPC client は維持する。
2. **MCP package の runtime 要件を Node.js 20 以上にする。** SDK v2 を使う `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` のみを対象とする。SDK v2 に依存しない CLI 等の Node.js 18 以上の要件は維持する。実装 PR で package metadata と利用者向け要件説明をそろえる。
3. **SDK に渡す schema を Zod 4.2.0 以上へ移す。** ツール schema は Standard Schema として明示的に構築し、optional・enum・union の入力制約を維持する。Zod 3 を使う他 package はこの移行のためだけに変更しない。
4. **SDK の登録 API を v2 形式にそろえる。** 本体とテスト fixture の `resource()` を `registerResource()` に、ツール登録を `registerTool()` と config object に移す。Issue #247 の `resource()` 整理はこの移行にまとめ、同じ変更を別 PR で重ねない。
5. **移行時点では現在の stdio protocol handshake を維持する。** `StdioServerTransport` と `server.connect()` を使い、`serveStdio()` への切り替えと 2026-07-28 protocol revision の提供は別途判断する。現行 debug client が使う 2024-11-05 の initialize handshake を含め、旧版 client との接続を検証する。
6. **v2 が変える wire 表現を明示的な互換性差分として扱う。** `tools/list` の JSON Schema は意味上の入力制約を維持するが、v1 と同一の JSON 形状までは保証しない。未登録 tool の呼び出しは v2 の `-32602` 応答に合わせる。この差分を利用者向けの移行説明と E2E 検証に含める。入力値の検証エラー、登録済み tool の応答、resources/list・resources/read の動作は引き続き確認する。
7. **Node.js 要件と wire 応答の互換性変更をリリース上の破壊的変更として扱う。** 実装 PR では `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` の major changeset を用意し、Node.js 18 の利用者が受ける影響と移行手順を記載する。package ごとの公開バージョンを SDK のバージョン番号に機械的に合わせない。

## Consequences

- MCP package の利用者は Node.js 20 以上が必要になる。CLI 等の別 package は Node.js 18 以上を維持するため、案内では package ごとの要件を区別する。
- SDK v2 の schema 出力と未登録 tool のエラー応答は v1 と異なる。v1 の JSON Schema 全体や応答形式に依存するクライアントは調整が必要になる。
- 2026-07-28 protocol revision の機能はこの移行では提供しない。必要になった段階で、client 対応と `serveStdio()` への切り替えを別途評価する。
- SDK v1 の保守期間には最低保証があるが、終了日は確定していない。v2 はすでに安定版のため、Node.js 20 への更新と破壊的変更の説明を含めて移行する。

## Unresolved and deferred

- SDK v1.x の保守終了日は公式資料に記載されていない。2027-01-27 頃は v2 公開後 6 か月の最低保証期間を満たす目安であり、確定した終了日ではない。
- 導入する v2 package の具体的な patch version は実装時点で選ぶ。公式の stable 2.x package を選び、リポジトリの既存方針に沿って lockfile と package manifest に固定する。
- 2026-07-28 protocol revision への対応は今回の移行対象外とする。現行利用者からの要件が出た段階で別途判断する。

## Implementation and verification requirements

実装 PR では、少なくとも以下を確認する。

- `@modelcontextprotocol/sdk` v1 への依存・import が package、実装、テスト fixture に残らない。
- workspace build と型チェックが通る。
- `tools/list` と `tools/call`、optional・enum・union schema の公開と入力検証、無効入力・未登録 tool の応答を stdio 経由で確認する。
- `resources/list` と `resources/read`、initialize handshake、stdio 起動を E2E で確認する。
- Node.js 要件、破壊的変更、Node.js 18 利用者向けの案内が package metadata と利用者向け文書で一致する。
