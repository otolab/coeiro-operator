#!/usr/bin/env python3
"""
iTerm2 APIを使用して背景画像を設定するスクリプト
"""

import iterm2
import sys
import json


async def main(connection):
    """メイン処理"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python set_background.py <config_json>"}))
        sys.exit(1)

    try:
        config = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    app = await iterm2.async_get_app(connection)

    # 対象セッションの特定（優先順位: projectName > sessionId > current_session）
    sessions = []

    if "projectName" in config and config["projectName"]:
        # 1. iTmuxプロジェクト名で全マッチウィンドウを検索
        project_name = config["projectName"]
        for window in app.windows:
            try:
                project_id = await window.async_get_variable("user.projectID")
                if project_id == project_name:
                    sessions.append(window.current_tab.current_session)
            except Exception:
                continue
        if not sessions:
            print(json.dumps({"error": f"Window with projectID '{project_name}' not found"}))
            return

    elif "sessionId" in config and config["sessionId"]:
        # 2. セッションIDでセッションを検索
        for window in app.windows:
            for tab in window.tabs:
                for s in tab.sessions:
                    if s.session_id == config["sessionId"]:
                        sessions.append(s)
                        break
                if sessions:
                    break
            if sessions:
                break

        if not sessions:
            # NOTE: current_sessionへのフォールバックは行わない
            # 意図しないウィンドウへの背景設定を防ぐため、対象が特定できない場合はエラーとする
            print(json.dumps({"error": f"Session with ID {config['sessionId']} not found"}))
            return
    else:
        # projectNameもsessionIdも未指定 → 対象ウィンドウを特定できない
        # NOTE: current_sessionへのフォールバックは行わない
        # 意図しないウィンドウへの背景設定を防ぐため、対象が特定できない場合はエラーとする
        print(json.dumps({"error": "No projectName or sessionId specified. Cannot identify target window."}))
        return

    # 設定を変更
    change = iterm2.LocalWriteOnlyProfile()

    if "imagePath" in config:
        change.set_background_image_location(config["imagePath"])

    if "opacity" in config:
        # blendは0-1の範囲で指定（0が完全に背景色、1が完全に画像）
        # opacityが1.0なら画像を完全に表示、0.0なら背景色のみ
        blend_value = config["opacity"]
        change.set_blend(blend_value)

    if "mode" in config:
        # BackgroundImageModeの設定
        mode_map = {
            "stretch": iterm2.BackgroundImageMode.STRETCH,
            "tile": iterm2.BackgroundImageMode.TILE,
            "fill": iterm2.BackgroundImageMode.ASPECT_FILL,
            "fit": iterm2.BackgroundImageMode.ASPECT_FIT
        }
        if config["mode"] in mode_map:
            change.set_background_image_mode(mode_map[config["mode"]])

    for session in sessions:
        await session.async_set_profile_properties(change)

    print(json.dumps({
        "success": True,
        "sessionIds": [s.session_id for s in sessions],
        "imagePath": config.get("imagePath"),
        "opacity": config.get("opacity"),
        "mode": config.get("mode")
    }))


if __name__ == "__main__":
    iterm2.run_until_complete(main)
