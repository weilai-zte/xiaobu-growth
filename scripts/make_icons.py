"""生成 PWA 图标 PNG（纯标准库实现，避免引入额外依赖）。

设计：暖米色底 + 浅绿圆 + 一株绿色小苗（两片叶子），与 favicon.svg 保持一致。
抗锯齿用 3x 超采样后盒式降采样。
"""

import math
import os
import struct
import zlib

BG = (246, 244, 239)
SOFT = (232, 240, 234)
GREEN = (65, 114, 90)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")
SS = 3  # 超采样倍数


def in_ellipse(x, y, cx, cy, rx, ry, angle_deg):
    rad = math.radians(angle_deg)
    dx, dy = x - cx, y - cy
    xr = dx * math.cos(rad) + dy * math.sin(rad)
    yr = -dx * math.sin(rad) + dy * math.cos(rad)
    return (xr / rx) ** 2 + (yr / ry) ** 2 <= 1.0


def in_capsule(x, y, x1, y1, x2, y2, half_width):
    vx, vy = x2 - x1, y2 - y1
    wx, wy = x - x1, y - y1
    seg_len_sq = vx * vx + vy * vy
    t = 0.0 if seg_len_sq == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / seg_len_sq))
    px, py = x1 + t * vx, y1 + t * vy
    return math.hypot(x - px, y - py) <= half_width


def color_at(u, v, scale):
    """u, v 为 0-1 归一化坐标（相对图标边长，已考虑 maskable 安全边距）。"""
    # 浅绿圆
    if math.hypot(u - 0.5, v - 0.52) <= 0.30 * scale:
        color = SOFT
    else:
        color = BG
    # 茎
    if in_capsule(u, v, 0.5, 0.68, 0.5, 0.49, 0.028 * scale):
        return GREEN
    # 两片叶子
    if in_ellipse(u, v, 0.405, 0.475, 0.105 * scale, 0.058 * scale, 32):
        return GREEN
    if in_ellipse(u, v, 0.595, 0.475, 0.105 * scale, 0.058 * scale, -32):
        return GREEN
    return color


def render(size, scale=1.0):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    u = (px + (sx + 0.5) / SS) / size
                    v = (py + (sy + 0.5) / SS) / size
                    r, g, b = color_at(u, v, scale)
                    acc[0] += r
                    acc[1] += g
                    acc[2] += b
            n = SS * SS
            row.extend((acc[0] // n, acc[1] // n, acc[2] // n))
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    height = len(rows)
    width = len(rows[0]) // 3
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        payload = tag + data
        return (
            struct.pack(">I", len(data))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    print(f"wrote {path} ({width}x{height})")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("apple-touch-icon-180.png", 180, 1.0),
        # maskable 需要留安全边距，所以把图案缩小
        ("maskable-512.png", 512, 0.72),
    ]
    for name, size, scale in targets:
        write_png(os.path.join(OUT_DIR, name), render(size, scale))


if __name__ == "__main__":
    main()
