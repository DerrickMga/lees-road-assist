"""
Generate Lee's Express Courier brand logo PNG using Pillow.
Branding: dark navy #1B1F5C text, red #CC1212 accent, white background.
"""
from PIL import Image, ImageDraw, ImageFont
import os, math

NAVY  = (27, 31, 92)    # #1B1F5C  — Lee's text + arrow base
RED   = (204, 18, 18)   # #CC1212  — EXPRESS COURIER + checkmark accent
WHITE = (255, 255, 255)


def draw_logo(size=(800, 400)):
    img = Image.new("RGBA", size, WHITE + (255,))
    d = ImageDraw.Draw(img)
    W, H = size

    # ── Icon: stylised chevron/check arrow (top-left quadrant) ──────────────
    # Navy arrow pointing right with red checkmark tick on top
    icon_cx, icon_cy = 110, H // 2
    # Draw a bold right-pointing arrowhead in navy
    arrow_pts = [
        (icon_cx - 60, icon_cy - 55),
        (icon_cx + 10, icon_cy - 55),
        (icon_cx + 70, icon_cy),
        (icon_cx + 10, icon_cy + 55),
        (icon_cx - 60, icon_cy + 55),
        (icon_cx - 10, icon_cy),
    ]
    d.polygon(arrow_pts, fill=NAVY)

    # Red diagonal check / tick slashed across the arrow
    tick_w = 14
    tick_pts = [
        (icon_cx - 25, icon_cy - 20),
        (icon_cx - 25 + tick_w, icon_cy - 20),
        (icon_cx + 55,  icon_cy + 55),
        (icon_cx + 55 - tick_w, icon_cy + 55),
    ]
    d.polygon(tick_pts, fill=RED)
    # Short upstroke of the tick
    d.polygon([
        (icon_cx - 25, icon_cy - 20),
        (icon_cx - 25 + tick_w, icon_cy - 20),
        (icon_cx - 5,  icon_cy - 55),
        (icon_cx - 5 - tick_w, icon_cy - 55),
    ], fill=RED)

    # ── "Lee's" text ─────────────────────────────────────────────────────────
    try:
        font_big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 160)
    except Exception:
        font_big = ImageFont.load_default()

    try:
        font_sub = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 52)
    except Exception:
        font_sub = ImageFont.load_default()

    text_x = 200
    d.text((text_x, H // 2 - 100), "Lee's", font=font_big, fill=NAVY)

    # ── "EXPRESS COURIER" subtitle in red ────────────────────────────────────
    d.text((text_x + 4, H // 2 + 68), "EXPRESS COURIER", font=font_sub, fill=RED)

    return img


def create_logo_png(width=800, height=400):
    """Legacy compatibility — returns raw PNG bytes."""
    import io
    img = draw_logo((width, height))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import io
    BASE = os.path.dirname(os.path.abspath(__file__))
    paths = [
        os.path.join(BASE, 'mobile/assets/images/logo.png'),
        os.path.join(BASE, 'web/public/logo.png'),
        os.path.join(BASE, 'backend/static/logo.png'),
    ]
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img = draw_logo((800, 300))
        img.convert("RGB").save(p, "PNG", optimize=True)
        print(f"Created: {p}")
    print("Done.")
