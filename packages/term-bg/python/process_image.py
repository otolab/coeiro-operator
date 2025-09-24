#!/usr/bin/env python3
"""
画像を右下に小さく配置するための前処理スクリプト
"""

from PIL import Image, ImageDraw
import sys
import json
import os


def create_positioned_image(source_path, output_path, position='bottom-right', scale=0.2, opacity=0.3, terminal_size=None):
    """
    画像を指定位置に配置した透明背景画像を作成

    Args:
        source_path: 元画像のパス
        output_path: 出力画像のパス
        position: 配置位置 ('bottom-right', 'top-right', etc.)
        scale: 画像のスケール (0.0-1.0)
        opacity: 透明度 (0.0-1.0, 0が透明、1が不透明)
        terminal_size: (width, height) タプル、またはNone
    """

    # 元画像を開く
    source = Image.open(source_path)

    # RGBA形式に変換
    if source.mode != 'RGBA':
        source = source.convert('RGBA')

    # 画面サイズを決定
    if terminal_size:
        screen_width, screen_height = terminal_size
    else:
        # デフォルトは一般的なターミナルサイズ
        screen_width = 1920
        screen_height = 1080

    # 新しいキャンバスを作成（透明背景）
    canvas = Image.new('RGBA', (screen_width, screen_height), (0, 0, 0, 0))

    # 画像をリサイズ（最大サイズを制限）
    max_width = min(int(screen_width * 0.3), 300)  # 画面幅の30%または300pxのうち小さい方
    max_height = min(int(screen_height * 0.3), 400)  # 画面高さの30%または400pxのうち小さい方

    # アスペクト比を保持してサイズを計算
    aspect_ratio = source.width / source.height
    if source.width > source.height:
        new_width = min(int(source.width * scale), max_width)
        new_height = int(new_width / aspect_ratio)
    else:
        new_height = min(int(source.height * scale), max_height)
        new_width = int(new_height * aspect_ratio)

    source_resized = source.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # 透明度を適用
    if opacity < 1.0:
        # アルファチャンネルを調整
        data = source_resized.getdata()
        new_data = []
        for item in data:
            # RGBAの場合
            if len(item) == 4:
                new_data.append((item[0], item[1], item[2], int(item[3] * opacity)))
            else:
                new_data.append((item[0], item[1], item[2], int(255 * opacity)))
        source_resized.putdata(new_data)

    # 配置位置を計算
    if position == 'bottom-right':
        x = screen_width - new_width - 50  # 右端から50px余白
        y = screen_height - new_height - 50  # 下端から50px余白
    elif position == 'top-right':
        x = screen_width - new_width - 50
        y = 50
    elif position == 'bottom-left':
        x = 50
        y = screen_height - new_height - 50
    elif position == 'top-left':
        x = 50
        y = 50
    else:  # center
        x = (screen_width - new_width) // 2
        y = (screen_height - new_height) // 2

    # キャンバスに画像を配置
    canvas.paste(source_resized, (x, y), source_resized)

    # 保存
    canvas.save(output_path, 'PNG')

    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python process_image.py <config_json>"}))
        sys.exit(1)

    try:
        config = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    source_path = config.get('sourcePath')
    output_path = config.get('outputPath', '/tmp/processed_bg.png')
    position = config.get('position', 'bottom-right')
    scale = config.get('scale', 0.2)
    opacity = config.get('opacity', 0.3)
    terminal_size = config.get('terminalSize')

    try:
        result_path = create_positioned_image(
            source_path,
            output_path,
            position=position,
            scale=scale,
            opacity=opacity,
            terminal_size=terminal_size
        )

        print(json.dumps({
            "success": True,
            "outputPath": result_path
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)