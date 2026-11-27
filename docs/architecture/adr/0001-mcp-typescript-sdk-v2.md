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
- SDK v1.32.2 は登録 tool に `execution.taskSupport: "forbidden"` を付けて `tools/list` に返す。v2.4.0 はこの `execution` を設定せず、JSON 化後は field が省略される。MCP 2025-11-25 では省略時も task execution は forbidden であり、v1/v2 の意味は同じだが JSON の形は異なる。SDK v2 の stable line は 2026-07-28 仕様にも対応し、その仕様では Tasks は core field ではなく extension として定義されている。
- この製品は MCP Tasks を使っていない。`MCPDebugClient.callTool()` は通常の `tools/call` を送り、`_meta` に Tasks extension capability を付けず、`tasks/*` を呼び出さない。MCP 本体の `say` は通常の `tools/call` にアプリ内 SpeechQueue の task ID を含めて返し、`wait_for_task_completion` などの通常 tool call でキュー完了を待てる。このアプリ内 task queue は MCP Tasks wire feature とは別機能である。利用中の外部 client の実態や、field の存在を独自に検査している client があるかは、リポジトリからは分からない。

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
- [MCP 2025-11-25 Tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP 2026-07-28 Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks)
- [SDK v2 の 2026-07-28 revision 対応ガイド](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)
- [TypeScript Tasks extension API](https://tasks.extensions.modelcontextprotocol.io/typescript/)

## Decision

1. **SDK v2 を移行先とし、互換性を実装時に検証する。** `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` を一つの実装 PR で移行し、両 package が使う公式 v2 package を依存に宣言する。SDK の client package は追加せず、mcp-debug の独自 JSON-RPC client は維持する。未知 tool の現行応答を保つ方法が未検証であるため、実装時に候補を検証する。現行挙動を維持できないと分かった場合は、protocol error への変更を独断で受け入れず、実装を止めて conductor に報告し、オペレータの判断を仰ぐ。
2. **SDK v2 移行に合わせて、Node.js の最低要件を 20 以上に引き上げる。** これは inq-1 で決定された方針であり、Node.js 18 対応を維持するための移行延期は選択肢としない。SDK v2 package の公式要件は `>=20` である。`@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` の package metadata、および利用者向け公開資料への反映は、後続の移行実装 PR で行う。この ADR-only PR には含めない。
3. **入力 schema は既存の公開形を保つ方法を優先して検証する。** SDK 既定の Zod 4 生成形をそのまま採ると `tools/list.inputSchema` の JSON 形状が変わる。v2 の `fromJsonSchema()` に明示 JSON Schema を渡せば、その文書を `inputSchema` として広告できる。現行の Zod 3 schema は公式移行ガイドにある `zod-to-json-schema` 等で変換するか、明示的に記述できるが、現在の v1 生成結果と完全一致することや、入力検証の意味が一致することは未検証である。optional・enum・union・数値制約を stdio E2E で照合する。なお、これで `execution.taskSupport` 等を含む tool 全体の形状まで維持できるとは判断しない。
4. **SDK の登録 API を v2 形式にそろえる。** 本体とテスト fixture の `resource()` を `registerResource()` に、ツール登録を `registerTool()` と config object に移す。Issue #247 の `resource()` 整理はこの移行にまとめ、同じ変更を別 PR で重ねない。
5. **移行時点では現在の stdio protocol handshake を維持する。** `StdioServerTransport` と `server.connect()` を使い、`serveStdio()` への切り替えと 2026-07-28 protocol revision の提供は別途判断する。現行 debug client が使う 2024-11-05 の initialize handshake を含め、旧版 client との接続を検証する。
6. **未登録 tool の現行応答を維持することを優先する。** SDK の error guide は、`isError: true` をモデルが読み取って回復できる tool result、ProtocolError を呼び出し側が処理する request-level error として区別している。v2.4.0 の高水準 `McpServer` に旧形式へ戻す公開設定は、確認した公式 API と実装には見当たらない。旧応答を保つには、低水準 API 上で独自 dispatch を実装するか、送受信境界で JSON-RPC error を変換する方法が考えられるが、SDK の handler 登録との共存、登録済み tool の検証や応答との整合、将来の SDK 更新への追従を要する。どちらもこの調査では実装可能性を実証していない。実装時に互換策を検証し、現行挙動を維持できない場合は変更を受け入れず、影響と実現可能な選択肢を conductor に返してオペレータの判断を仰ぐ。未登録 tool の `-32602` を採用する決定はこの ADR では行わない。
7. **入力 schema 検証エラーは未登録 tool と区別する。** v2.4.0 の実装では登録済み tool の schema 検証失敗を `isError: true` の tool result に包むため、現行の wire 形式を維持できる見込みである。ただし、Zod 3 から明示 JSON Schema へ移した後の制約とエラーメッセージは未確認であり、入力検証の意味を E2E で確かめる。エラーメッセージの完全一致までは現行テストが要求していない。
8. **SDK と製品 package のバージョンは切り分ける。** SDK の v2 は upstream の major update だが、製品 package の changeset はオペレータ方針に従い `@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` とも minor とする。この分類は互換性が保たれることを意味せず、Node.js 要件や、判断のうえで受け入れた wire 差分があれば changeset と利用者向けリリース説明で明示する。minor を理由に既存挙動の変更を自動的に許容しない。
9. **`tools/list` の `execution.taskSupport: "forbidden"` 省略を受け入れる。** inq-3 でオペレータがこの JSON 差分を受容した。MCP 2025-11-25 仕様では `taskSupport` 省略時の既定値も forbidden であり、準拠 client が task execution を行わないという意味は変わらない。MCP 2026-07-28 仕様では Tasks は別 extension となり、SDK v2.4.0 の旧 task wire 型は互換用途として deprecated である。この製品はどちらの Tasks 機構も実装せず、通常の `tools/call` を使う。`say` のバックグラウンド音声キューと `wait_for_task_completion` はアプリ内機能で、この変更では維持する。field の有無に依存する独自 client には wire 上の差があるため、changeset と公開 README に明記する。外部 client の利用状況や独自依存の有無は確認できていない。

## Consequences

- Node.js 20 以上への引き上げは決定済みである。`@coeiro-operator/mcp` と `@coeiro-operator/mcp-debug` の package metadata に `engines` を明記し、root README、インストールガイド、MCP README の更新は後続の移行実装 PR で行う。この ADR-only PR では方針を記録し、公開資料や package metadata は変更しない。
- `tools/list.inputSchema` は明示 JSON Schema により現在の形を保てる選択肢がある一方、schema 文書の等価性と tool 全体の wire 形状は別々に検証が必要となる。
- v1 が明示していた `execution: { taskSupport: "forbidden" }` は v2 の `tools/list` では省略される。これは inq-3 で受容済みの wire 差分であり、MCP 2025-11-25 仕様の既定意味は同じである。MCP Tasks を使わない通常の tool call とアプリ内音声キューには影響しない。field の存在を前提にする独自 client には差が見える可能性があるが、実際の外部利用状況は不明である。
- 未登録 tool の応答を変えると、MCP client から見た protocol error に加え、mcp-debug の `callTool()` が reject し、E2E helper では `success: false` となる。現行応答の維持を優先し、互換策は実装時に検証する。維持できない場合は、protocol error を採用するか移行を延期するかなど、確認できた選択肢と影響を示してオペレータの判断を仰ぐ。どの選択肢もこの ADR で先取りしない。
- 登録済み tool の不正入力は、SDK v2.4.0 の実装上は `isError: true` の tool result のままである。そのため mcp-debug の `callTool()` は resolve し、E2E helper は `success: true` と `result.isError: true` を返す見込みだが、実際の v2 server と接続した検証はしていない。変換後の入力制約やエラー本文が同じとは限らない。
- 2026-07-28 protocol revision の機能はこの移行では提供しない。必要になった段階で、client 対応と `serveStdio()` への切り替えを別途評価する。
- 製品 package の release level は minor とする指示が決定済みである。既存互換性の維持・変更可否は別の判断であり、minor 分類からは導けない。

## Unresolved and deferred

- **Node.js 要件と公開資料:** SDK v2 移行に伴い最低要件を Node.js 20 以上へ引き上げることは inq-1 で決定済み。package metadata と、root README・インストールガイド・MCP README の公開要件表示は後続の移行実装 PR で更新する。この ADR-only PR では変更しない。
- **未登録 tool の応答:** 現行 result 形式を維持する独自 dispatch / 応答変換の実現可能性を移行実装時に検証する。SDK v2.4.0 の標準 `McpServer` handler には設定による切り替えが見当たらず、独自策の共存方法・保守コストは未検証である。mcp-debug 利用者には直接の `callTool()` rejection、`MCPServiceE2ETester` の `{ success: false, error }` という差が見込まれる。公開 `MCPToolCallResponse.isError` は tool result の型であり、protocol error を表す型ではない。互換策が成立しない場合は実装を止め、protocol error を採用するか、移行を延期するかなどの選択肢と影響を conductor に報告してオペレータの判断を仰ぐ。現時点で互換策の実現性は未検証であり、いずれかの選択を既定にしない。
- **入力検証エラー:** v2.4.0 のソースでは入力 schema error は result-level `isError: true` に変換されるため、旧応答形式を維持できる見込みである。明示 JSON Schema への移行後も optional・enum・union・数値制約と失敗応答が同じ意味になるか、stdio E2E で確認する。実行前のため、互換性は未検証である。
- **`tools/list` schema:** 現行の `inputSchema` 文書を JSON Schema として明示し、v2 の `fromJsonSchema()` に渡す方法を第一候補とする。公式資料は渡した文書がそのまま広告されるとしている。Zod 3 schema からの変換には `zod-to-json-schema` を使う選択肢も公式ガイドにある。ただし現行 v1 の実際の JSON と一致するか、validator の動作が一致するかは未検証である。`execution.taskSupport` の省略は inq-3 で受容済みのため、移行テストでは v2 の省略形と通常の tool call が使えることを確認する。
- **実装時の検証範囲:** 未登録 tool と登録済み tool の不正入力を別テストにする。mcp-debug では直接の `MCPDebugClient.callTool()` と `MCPServiceE2ETester.callTool()` の両方で結果契約を確認する。`tools/list` では inputSchema の文書と `execution` の省略を別々に確認し、通常の `tools/call` とアプリ内 `wait_for_task_completion` が利用できることを確認する。
- SDK v1.x の保守終了日は公式資料に記載されていない。2027-01-27 頃は v2 公開後 6 か月の最低保証期間を満たす目安であり、確定した終了日ではない。
- 導入する v2 package の具体的な patch version は実装時点で選ぶ。公式の stable 2.x package を選び、リポジトリの既存方針に沿って lockfile と package manifest に固定する。
- 2026-07-28 protocol revision への対応は今回の移行対象外とする。現行利用者からの要件が出た段階で別途判断する。

## Implementation and verification requirements

実装 PR では、少なくとも以下を確認する。

- `@modelcontextprotocol/sdk` v1 への依存・import が package、実装、テスト fixture に残らない。
- workspace build と型チェックが通る。
- `tools/list` と `tools/call`、optional・enum・union schema の公開と入力検証、無効入力・未登録 tool の応答を stdio 経由で確認する。入力 schema error と未知 tool は別々に確認し、mcp-debug の公開 API に現れる成功・失敗値も検証する。`tools/list` の `execution.taskSupport` 省略は inq-3 で受容済みの差分として確認し、通常の `tools/call` とアプリ内キュー待機 tool の動作を確かめる。
- `resources/list` と `resources/read`、initialize handshake、stdio 起動を E2E で確認する。
- オペレータ方針に従い両 package に minor changeset を用意する。Node.js 20 以上の要件を両 package の metadata と root README・インストールガイド・MCP README に反映する。公開資料の更新は後続の移行実装 PR に含める。未知 tool の現行応答を保つ互換策を検証し、維持できない場合は protocol error への変更を受け入れず、確認した事実・影響・選択肢を conductor に返してオペレータの判断を仰ぐ。未解決の互換性判断が残る場合は実装を止める。
