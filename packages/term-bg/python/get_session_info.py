#!/usr/bin/env python3
"""
現在のiTerm2セッション情報を取得するスクリプト
"""

import iterm2
import json
import sys


async def main(connection):
    """メイン処理"""
    app = await iterm2.async_get_app(connection)

    # 現在のウィンドウとセッションを取得
    window = app.current_terminal_window
    if not window:
        print(json.dumps({"error": "No current window found"}))
        return

    tab = window.current_tab
    session = tab.current_session

    # セッション情報を収集
    session_info = {
        "session_id": session.session_id,
        "window_id": window.window_id,
        "tab_id": tab.tab_id,
    }

    # 環境変数からも情報を取得
    try:
        term_session_id = await session.async_get_variable("TERM_SESSION_ID")
        if term_session_id:
            session_info["term_session_id"] = term_session_id
    except:
        pass

    try:
        iterm2_session_id = await session.async_get_variable("ITERM_SESSION_ID")
        if iterm2_session_id:
            session_info["iterm2_session_id"] = iterm2_session_id
    except:
        pass

    print(json.dumps(session_info))


if __name__ == "__main__":
    iterm2.run_until_complete(main)