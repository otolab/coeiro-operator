#!/bin/bash

# Issue #93 のテスト: アサインが時間切れした端末で say-coeiroink コマンドの動作を確認

echo "=== オペレータタイムアウトテスト ==="
echo

# 1. 現在の状態を確認
echo "1. 現在のオペレータ状態を確認..."
./scripts/operator-manager status
echo

# 2. オペレータをアサイン（短いタイムアウトで）
echo "2. テスト用にオペレータをアサイン（つくよみちゃん）..."
./scripts/operator-manager assign tsukuyomi
echo

# 3. 正常に動作することを確認
echo "3. アサイン直後の say-coeiroink を実行..."
./scripts/say-coeiroink "アサイン直後のテストです"
echo

# 4. タイムアウトをシミュレート
# 実際にはファイルの updated_at を手動で古い時刻に変更する必要がある
echo "4. オペレータファイルを操作してタイムアウトをシミュレート..."
HOSTNAME_CLEAN=$(hostname | sed 's/[^a-zA-Z0-9]/_/g')
OPERATOR_FILE="/tmp/coeiroink-operators-${HOSTNAME_CLEAN}.json"

if [ -f "$OPERATOR_FILE" ]; then
    echo "   オペレータファイル: $OPERATOR_FILE"

    # ファイルの内容を読み込んで、updated_at を5時間前に変更
    # 現在時刻から5時間引いた時刻を計算
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        OLD_TIME=$(date -v-5H -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    else
        # Linux
        OLD_TIME=$(date -u -d '5 hours ago' +"%Y-%m-%dT%H:%M:%S.%3NZ")
    fi

    echo "   updated_at を $OLD_TIME に変更..."

    # jq を使用してJSONを編集
    if command -v jq &> /dev/null; then
        # セッションIDを取得（環境変数から）
        SESSION_ID=${ITERM_SESSION_ID:-${TERM_SESSION_ID:-$(echo $PPID)}}
        SESSION_ID=$(echo $SESSION_ID | sed 's/[:-]/_/g')

        # JSONを更新
        jq --arg session "$SESSION_ID" --arg time "$OLD_TIME" \
           '.storage[$session].updated_at = $time' \
           "$OPERATOR_FILE" > "${OPERATOR_FILE}.tmp" && \
        mv "${OPERATOR_FILE}.tmp" "$OPERATOR_FILE"

        echo "   ファイルを更新しました"
        echo "   更新後の内容:"
        jq . "$OPERATOR_FILE"
    else
        echo "   エラー: jq がインストールされていません"
        echo "   brew install jq でインストールしてください"
        exit 1
    fi
else
    echo "   オペレータファイルが見つかりません"
    exit 1
fi
echo

# 5. タイムアウト後の状態を確認
echo "5. タイムアウト後のオペレータ状態を確認..."
./scripts/operator-manager status
echo

# 6. タイムアウト後の say-coeiroink を実行
echo "6. タイムアウト後の say-coeiroink を実行..."
./scripts/say-coeiroink "タイムアウト後のテストです。デフォルト音声で再生されるべきです。"
echo

echo "=== テスト完了 ==="
echo "期待される動作:"
echo "  - タイムアウト前: つくよみちゃんの音声で再生"
echo "  - タイムアウト後: デフォルト音声（つくよみちゃん）で再生"
echo "    （CLIではallowFallback=trueなので、オペレータがいなくてもデフォルト音声を使用）"