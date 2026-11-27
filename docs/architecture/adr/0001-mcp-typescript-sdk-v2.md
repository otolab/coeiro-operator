# ADR-0001: MCP TypeScript SDK v2 への移行方針

- Status: Proposed
- Date: 2026-11-27
- Issue: [#248](https://github.com/otolab/coeiro-operator/issues/248)

## Context

Issue #248 は、`@modelcontextprotocol/sdk` v1 から公式 TypeScript SDK v2 への移行を扱う。v2 は 2026-07-27 に安定版として公開され、サーバーとクライアントの package が分割された。公式 v1.x は v2 公開後少なくとも 6 か月、バグ修正とセキュリティ更新を受けるが、保守終了日は明示されていない。最低保証期間は 2027-01-27 頃までとなる。

現行リポジトリでは、`@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` が SDK v1.32.2 と Zod 3.25.76 に依存している。MCP 本体はツールを登録し、stdio transport で起動する。ユーザーガイドの resource 登録には v1 の `resource()` を使っている。mcp-debug のテスト用 echo server も SDK の server API を使う一方、debug client は JSON-RPC を直接扱う独自実装であり、SDK の client API は使っていない。

現行の [root README](../../../README.md)、[インストールガイド](../../user-guide/installation.md)、[MCP README](../../../packages/mcp/README.md) は Node.js 18 以上を案内している。両 package の `package.json` に `engines` 指定はない。

公式 SDK v2.4.0 の資料と実装から、次の互換性条件が分かった。

- `@modelcontextprotocol/server@2.4.0` の package metadata は Node.js `>=20` を要求する。MCP package で公式 v2 を使うなら Node.js 18 の動作保証は続けられない。ツールや resource の schema には Standard Schema が必要で、Zod を使う場合は 4.2.0 以上が公式の推奨条件となる。Zod 3 schema はそのまま渡せない。
- package は `@modelcontextprotocol/server` などに分割された。stdio transport は `@modelcontextprotocol/server/stdio` から読み込む。
- `resource()` は v2 で削除され、`registerResource()` に置き換わる。ツール登録では `registerTool()` と明示的な config object を使う。
- `server.connect(new StdioServerTransport())` は v2 でも利用できる。新しい 2026-07-28 protocol revision を提供する場合は `serveStdio()` への切り替えが必要となる。
- Zod から生成する `tools/list` の `inputSchema` は v1 と同じ形にはならない。v2 は JSON Schema 2020-12 を使い、`additionalProperties` の出力なども変わる。一方、公式 `fromJsonSchema()` は渡した JSON Schema 文書をそのまま広告するため、明示 JSON Schema で `inputSchema` の形を保つ選択肢がある。これは tool 全体の wire object（例: `execution.taskSupport` の有無）まで同一にするものではない。
- v2.4.0 の `McpServer` は未登録・無効 tool の検査で `ProtocolError(-32602)` を投げる。この検査は `tools/call` handler の tool-error 変換用 try/catch より前にある。一方、登録済み tool の入力 schema 検証失敗は try/catch 内で `isError: true` の `CallToolResult` に変換される。
- 現行 E2E は、未登録 tool と不正入力の両方について `success: true` かつ `result.isError: true` を期待する別々のケースを持つ。SDK v2 では未登録 tool のみ応答経路が変わる見込みである。mcp-debug の `MCPDebugClient.callTool()` は JSON-RPC error を reject し、`MCPServiceE2ETester.callTool()` はその例外を `{ success: false, error }` として返す実装である。これはコードから読める帰結であり、v2 実サーバーとの E2E 確認はまだ行っていない。

参照した公式資料:

- [MCP TypeScript SDK README](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/README.md)
- [SDK ROADMAP](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/ROADMAP.md)
- [v1 から v2 への移行ガイド](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)
- [v2 の schema library / `fromJsonSchema()` ガイド](https://ts.sdk.modelcontextprotocol.io/v2/advanced/schema-libraries)
- [v2 の error semantics](https://ts.sdk.modelcontextprotocol.io/v2/servers/errors)
- [`@modelcontextprotocol/server@2.4.0` の Node.js 要件](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/packages/server/package.json)
- [v2.4.0 `McpServer` の tool dispatch 実装](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/packages/server/src/server/mcp.ts)
- [v2 の package 構成](https://ts.sdk.modelcontextprotocol.io/v2/get-started/packages)
- [stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)

## Decision

1. **SDK v2 を移行先とするが、互換性判断がつくまで実装には進まない。** Node.js 18 対応を維持する場合、または未登録 tool の旧応答を保つ実証済み手段がない場合は、v1 の保守保証期間内で移行を延期する選択肢を残す。v2 への移行を選んだ場合は `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` を一つの実装 PR で移行し、両 package が使う公式 v2 package を依存に宣言する。SDK の client package は追加せず、mcp-debug の独自 JSON-RPC client は維持する。
2. **Node.js 18 の継続可否を、v2 移行とは別に決める。** v2 を採る場合、MCP package は Node.js 20 以上が必要となる。Node.js 18 の利用者を維持するなら、現時点で確認できる選択肢は v1 を使った移行延期である。公式 v1.x branch の修正保証は v2 公開後少なくとも 6 か月（2027-01-27 頃まで）だが、それ以降の保守終了日は公表されていない。移行延期は恒久策とはみなさず、保証期間内に再評価する。
3. **入力 schema は既存の公開形を保つ方法を優先して検証する。** SDK 既定の Zod 4 生成形をそのまま採ると `tools/list.inputSchema` の JSON 形状が変わる。v2 の `fromJsonSchema()` に明示 JSON Schema を渡せば、その文書を `inputSchema` として広告できる。現行の Zod 3 schema は公式移行ガイドにある `zod-to-json-schema` 等で変換するか、明示的に記述できるが、現在の v1 生成結果と完全一致することや、入力検証の意味が一致することは未検証である。optional・enum・union・数値制約を stdio E2E で照合する。なお、これで `execution.taskSupport` 等を含む tool 全体の形状まで維持できるとは判断しない。
4. **SDK の登録 API を v2 形式にそろえる。** 本体とテスト fixture の `resource()` を `registerResource()` に、ツール登録を `registerTool()` と config object に移す。Issue #247 の `resource()` 整理はこの移行にまとめ、同じ変更を別 PR で重ねない。
5. **移行時点では現在の stdio protocol handshake を維持する。** `StdioServerTransport` と `server.connect()` を使い、`serveStdio()` への切り替えと 2026-07-28 protocol revision の提供は別途判断する。現行 debug client が使う 2024-11-05 の initialize handshake を含め、旧版 client との接続を検証する。
6. **未登録 tool の旧応答を維持できるかは未決とする。** SDK の error guide は、`isError: true` をモデルが読み取って回復できる tool result、ProtocolError を呼び出し側が処理する request-level error として区別している。v2.4.0 の高水準 `McpServer` に旧形式へ戻す公開設定は、確認した公式 API と実装には見当たらない。旧応答を保つには、低水準 API 上で独自 dispatch を実装するか、送受信境界で JSON-RPC error を変換する方法が考えられるが、SDK の handler 登録との共存、登録済み tool の検証や応答との整合、将来の SDK 更新への追従を要する。どちらもこの調査では実装可能性を実証していない。互換維持策を実証できない場合、現行挙動維持を優先して v2 移行を延期する。未登録 tool の `-32602` を採用する決定はこの ADR では行わない。
7. **入力 schema 検証エラーは未登録 tool と区別する。** v2.4.0 の実装では登録済み tool の schema 検証失敗を `isError: true` の tool result に包むため、現行の wire 形式を維持できる見込みである。ただし、Zod 3 から明示 JSON Schema へ移した後の制約とエラーメッセージは未確認であり、入力検証の意味を E2E で確かめる。エラーメッセージの完全一致までは現行テストが要求していない。
8. **SDK と製品 package のバージョンは切り分ける。** SDK の v2 は upstream の major update だが、製品 package の changeset はオペレータ方針に従い `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` とも minor とする。この分類は互換性が保たれることを意味せず、Node.js 要件や、判断のうえで受け入れた wire 差分があれば changeset と利用者向けリリース説明で明示する。minor を理由に既存挙動の変更を自動的に許容しない。

## Consequences

- v2 を採用する場合、MCP package の Node.js 最低要件は 20 となる。package metadata に `engines` を明記し、[root README](../../../README.md)、[インストールガイド](../../user-guide/installation.md)、[MCP README](../../../packages/mcp/README.md) の Node.js 18 表記を package ごとの要件に整理する必要がある。Node.js 18 を維持するなら v1 の利用を続けて移行を延期するが、公式保守保証の先は不明である。
- `tools/list.inputSchema` は明示 JSON Schema により現在の形を保てる選択肢がある一方、schema 文書の等価性と tool 全体の wire 形状は別々に検証が必要となる。
- 未登録 tool の応答を変えると、MCP client から見た protocol error に加え、mcp-debug の `callTool()` が reject し、E2E helper では `success: false` となる。変更を採る場合はこの利用者影響を release note に記載する。現時点で受け入れは決定していない。
- 登録済み tool の不正入力は、SDK v2.4.0 の実装上は `isError: true` の tool result のままである。そのため mcp-debug の `callTool()` は resolve し、E2E helper は `success: true` と `result.isError: true` を返す見込みだが、実際の v2 server と接続した検証はしていない。変換後の入力制約やエラー本文が同じとは限らない。
- 2026-07-28 protocol revision の機能はこの移行では提供しない。必要になった段階で、client 対応と `serveStdio()` への切り替えを別途評価する。
- 製品 package の release level は minor とする指示が決定済みである。既存互換性の維持・変更可否は別の判断であり、minor 分類からは導けない。

## Unresolved and deferred

- **Node.js 対応方針:** MCP package を Node.js 20 以上へ引き上げて v2 に進むか、Node.js 18 対応を守って v1 のまま移行を延期するかを決める。v2 server package の公式 metadata は `>=20`。v1 の保守は少なくとも 2027-01-27 頃まで保証されるが、その先の終了日は未公表である。v2 に進むなら `packages/mcp/package.json` と `packages/mcp-debug/package.json` の `engines`、root README、インストールガイド、MCP README を更新対象とする。
- **未登録 tool の応答:** 現行 result 形式を維持する独自 dispatch / 応答変換を設計・検証するか、互換維持策がなければ v1 継続で移行を延期するかを決める。SDK v2.4.0 の標準 `McpServer` handler には設定による切り替えが見当たらず、独自策の共存方法・保守コストは未検証である。v2 の protocol error を採る判断は行っていない。mcp-debug 利用者には直接の `callTool()` rejection、`MCPServiceE2ETester` の `{ success: false, error }` という差が見込まれる。公開 `MCPToolCallResponse.isError` は tool result の型であり、protocol error を表す型ではない。
- **入力検証エラー:** v2.4.0 のソースでは入力 schema error は result-level `isError: true` に変換されるため、旧応答形式を維持できる見込みである。明示 JSON Schema への移行後も optional・enum・union・数値制約と失敗応答が同じ意味になるか、stdio E2E で確認する。実行前のため、互換性は未検証である。
- **`tools/list` schema:** 現行の `inputSchema` 文書を JSON Schema として明示し、v2 の `fromJsonSchema()` に渡す方法を第一候補とする。公式資料は渡した文書がそのまま広告されるとしている。Zod 3 schema からの変換には `zod-to-json-schema` を使う選択肢も公式ガイドにある。ただし現行 v1 の実際の JSON と一致するか、validator の動作が一致するかは未検証である。`execution.taskSupport` を含む tool 全体の形はこの方法では保たれないため、別途比較・判断する。
- **実装時の検証範囲:** 未登録 tool と登録済み tool の不正入力を別テストにする。mcp-debug では直接の `MCPDebugClient.callTool()` と `MCPServiceE2ETester.callTool()` の両方で結果契約を確認する。`tools/list` では inputSchema の文書と `execution` 等を分けて比較する。
- SDK v1.x の保守終了日は公式資料に記載されていない。2027-01-27 頃は v2 公開後 6 か月の最低保証期間を満たす目安であり、確定した終了日ではない。
- 導入する v2 package の具体的な patch version は実装時点で選ぶ。公式の stable 2.x package を選び、リポジトリの既存方針に沿って lockfile と package manifest に固定する。
- 2026-07-28 protocol revision への対応は今回の移行対象外とする。現行利用者からの要件が出た段階で別途判断する。

## Implementation and verification requirements

実装 PR では、少なくとも以下を確認する。

- `@modelcontextprotocol/sdk` v1 への依存・import が package、実装、テスト fixture に残らない。
- workspace build と型チェックが通る。
- `tools/list` と `tools/call`、optional・enum・union schema の公開と入力検証、無効入力・未登録 tool の応答を stdio 経由で確認する。入力 schema error と未知 tool は別々に確認し、mcp-debug の公開 API に現れる成功・失敗値も検証する。
- `resources/list` と `resources/read`、initialize handshake、stdio 起動を E2E で確認する。
- オペレータ方針に従い両 package に minor changeset を用意する。v2 を採用する場合は Node.js 要件を package metadata と上記の利用者向け資料でそろえ、受け入れた wire 差分と mcp-debug client の結果契約を release note に明示する。未解決の互換性判断が残る場合は実装へ進まず conductor に返す。
