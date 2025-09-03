# ユーザー辞書登録ガイド

COEIROINKのユーザー辞書機能を使用して、カスタム単語の読み方とアクセントを登録する方法を説明します。

## 🆕 COEIRO Operatorの辞書機能

COEIRO Operatorは辞書データの永続化と自動登録機能を提供しています：

- **永続化**: 登録した辞書を`~/.coeiro-operator/user-dictionary.json`に保存
- **自動登録**: MCPサーバー起動時に保存された辞書を自動的に登録
- **半角英数字の自動変換**: API制限を回避して半角英数字も登録可能
- **デフォルト辞書**: 技術用語とキャラクター名を事前定義

### デフォルト辞書の内容

#### 技術用語
- **音声合成**: COEIRO（コエイロ）、COEIROINK（コエイロインク）
- **AI関連**: Claude（クロード）、Anthropic（アンソロピック）、ChatGPT（チャットジーピーティー）
- **開発ツール**: GitHub（ギットハブ）、TypeScript（タイプスクリプト）、Node.js（ノードジェイエス）、npm（エヌピーエム）
- **プロトコル**: MCP（エムシーピー）、API（エーピーアイ）、JSON（ジェイソン）、CLI（シーエルアイ）、GUI（ジーユーアイ）

#### キャラクター名
- つくよみちゃん（ツクヨミチャン）
- アンジー、アルマ、ディア、リリン、クロワ

## 概要

COEIROINK APIの`/v1/set_dictionary`エンドポイントを使用することで、固有名詞や専門用語の読み方を正確に制御できます。

## API仕様

### エンドポイント
```
POST http://localhost:50032/v1/set_dictionary
```

### リクエスト形式
```json
{
  "dictionaryWords": [
    {
      "word": "登録する単語",
      "yomi": "読み方（カタカナ）",
      "accent": アクセント位置（整数）,
      "numMoras": モーラ数（整数）
    }
  ]
}
```

### パラメータ説明

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| word | string | ✓ | 登録する単語（表記） |
| yomi | string | ✓ | 読み方（カタカナ表記） |
| accent | integer | ✓ | アクセント位置（0は平板型、1以上は該当モーラが高い） |
| numMoras | integer | ✓ | モーラ数（カタカナの音節数） |

## モーラとアクセントの数え方

### モーラ数
日本語の音節単位です。基本的に以下のルールで数えます：
- 清音・濁音・半濁音: 1モーラ（カ、ガ、パ = 各1モーラ）
- 拗音（ャ、ュ、ョ）: 前の音と合わせて1モーラ（キャ = 1モーラ）
- 促音（ッ）: 1モーラ
- 長音（ー）: 1モーラ
- 撥音（ン）: 1モーラ

### アクセント位置
- **0**: 平板型（音の高低差がない）
- **1**: 頭高型（最初のモーラが高い）
- **2以上**: 中高型・尾高型（指定位置のモーラが高い）

## COEIRO Operatorでの使用方法

### CLIコマンド

```bash
# デフォルト技術用語を登録（永続化）
dictionary-register

# プリセット辞書を登録
dictionary-register --preset all

# カスタム単語を登録
dictionary-register --word Redis --yomi レディス --accent 1 --moras 4

# カスタム辞書ファイルから登録
dictionary-register --file my-dictionary.json

# 韻律解析テスト
dictionary-register --test "COEIRO"
```

### MCPツール

Claude CodeのMCPツールから単語を簡単に登録できます。登録した単語は自動的に永続化され、次回起動時に復元されます。

```javascript
// 単語を登録（自動的に永続化）
dictionary_register({
  word: "Redis",
  yomi: "レディス",
  accent: 1,      // 1番目のモーラ（「れ」）が高い
  numMoras: 4     // レ・ディ・ス = 4モーラ
})
```

#### MCPツールの特徴
- **単一単語の登録**: 一度に1つの単語を登録（シンプルなインターフェース）
- **自動永続化**: 登録した単語は自動的に保存される
- **重複管理**: 同じ単語を再登録すると自動的に上書き更新
- **設定の自動取得**: COEIROINKサーバーの接続情報は設定ファイルから自動取得
- **統合管理**: デフォルト辞書（技術用語・キャラクター名）とカスタム辞書を統合して管理

## API直接使用例

### 1. 技術用語の登録

```bash
# "COEIRO"を「コエイロ」と読ませる
curl -X POST "http://localhost:50032/v1/set_dictionary" \
  -H "Content-Type: application/json" \
  -d '{
    "dictionaryWords": [
      {
        "word": "COEIRO",
        "yomi": "コエイロ",
        "accent": 2,
        "numMoras": 4
      }
    ]
  }'
```

### 2. 複数単語の一括登録

```bash
curl -X POST "http://localhost:50032/v1/set_dictionary" \
  -H "Content-Type: application/json" \
  -d '{
    "dictionaryWords": [
      {
        "word": "Claude",
        "yomi": "クロード",
        "accent": 2,
        "numMoras": 4
      },
      {
        "word": "MCP",
        "yomi": "エムシーピー",
        "accent": 0,
        "numMoras": 6
      },
      {
        "word": "つくよみちゃん",
        "yomi": "ツクヨミチャン",
        "accent": 3,
        "numMoras": 6
      }
    ]
  }'
```

### 3. 社名・製品名の登録

```bash
curl -X POST "http://localhost:50032/v1/set_dictionary" \
  -H "Content-Type: application/json" \
  -d '{
    "dictionaryWords": [
      {
        "word": "Anthropic",
        "yomi": "アンソロピック",
        "accent": 4,
        "numMoras": 7
      },
      {
        "word": "GitHub",
        "yomi": "ギットハブ",
        "accent": 3,
        "numMoras": 5
      }
    ]
  }'
```

## アクセント型の例

### 平板型（accent: 0）
```json
{
  "word": "プログラム",
  "yomi": "プログラム",
  "accent": 0,
  "numMoras": 5
}
```
→ プ↗ロ→グ→ラ→ム→（高さが一定）

### 頭高型（accent: 1）
```json
{
  "word": "カメラ",
  "yomi": "カメラ",
  "accent": 1,
  "numMoras": 3
}
```
→ カ↗メ↘ラ↘（最初だけ高い）

### 中高型（accent: 2-3）
```json
{
  "word": "ヤマダ",
  "yomi": "ヤマダ",
  "accent": 2,
  "numMoras": 3
}
```
→ ヤ↗マ↗ダ↘（2番目が高い）

## 注意事項

1. **永続性**: 登録した辞書はCOEIROINKプロセスが再起動されるとリセットされます
2. **上書き**: 同じ単語を再登録すると、以前の設定が上書きされます
3. **優先順位**: ユーザー辞書の設定は、デフォルトの読み方より優先されます
4. **文字種**: 単語はひらがな、カタカナ、漢字、英数字を含むことができます
5. **読み方**: yomiは全角カタカナで指定してください

### 既知の問題と制限事項

**API経由の辞書登録の制限**
1. **登録時は全角英数字が必要**
   - 登録：「KARTE」（半角）→ ✗ 登録できない
   - 登録：「ＫＡＲＴＥ」（全角）→ ✓ 登録可能
   - **重要**: 全角で登録すれば、半角・全角どちらの入力にも適用されます
   - 例：「ＫＡＲＴＥ」で登録 → 「KARTE」「ＫＡＲＴＥ」どちらも「カルテ」と読まれる
   - **COEIRO Operatorでは自動変換**: 半角英数字は自動的に全角に変換されます

2. **永続化されない（COEIROINK API自体の制限）**
   - API経由の辞書登録はメモリ上のみ
   - COEIROINKを再起動すると消える
   - 管理画面の辞書ファイル（`dictionaryStore.json`）には保存されない
   - **COEIRO Operatorの解決策**: 辞書データを独自に永続化し、起動時に自動登録

3. **レスポンスの仕様**
   - 成功/失敗に関わらず常に`null`を返す
   - HTTPステータスは200（エラーでも200が返る可能性）

**推奨される回避策**
- 半角英数字の単語は全角文字で登録する
- 永続的な辞書登録が必要な場合は管理画面を使用
- 登録後は必ず`estimate_prosody`で効果を確認

## 辞書効果の確認

### estimate_prosody APIを使った確認

登録した単語が正しく適用されているか、`/v1/estimate_prosody`エンドポイントで確認できます：

```bash
# 韻律解析で辞書の効果を確認
curl -X POST "http://localhost:50032/v1/estimate_prosody" \
  -H "Content-Type: application/json" \
  -d '{"text": "COEIROで音声合成"}' | jq
```

レスポンス例：
```json
{
  "plain": ["^", "k", "o", "[", "e", "i", "r", "o", ...],
  "detail": [[
    {
      "phoneme": "k-o",
      "hira": "こ",
      "accent": 0
    },
    {
      "phoneme": "e",
      "hira": "え",
      "accent": 1
    },
    ...
  ]]
}
```

- `plain`: 音素記号の配列
- `detail`: 各モーラの詳細情報（音素、ひらがな、アクセント）

辞書登録前後で比較することで、単語の読み方が正しく適用されているか確認できます。

## トラブルシューティング

### 単語が正しく読まれない
- モーラ数が正しいか確認（拗音は1モーラとして数える）
- アクセント位置がモーラ数を超えていないか確認
- カタカナ表記が正しいか確認

### APIエラーが発生する
- COEIROINKが起動しているか確認
- ポート50032でアクセス可能か確認
- JSONフォーマットが正しいか確認

## 関連ドキュメント

- [configuration-guide.md](configuration-guide.md) - COEIRO Operator設定ガイド
- [audio-system.md](audio-system.md) - 音声システム詳細