import math
import os
from PIL import Image, ImageDraw

def create_boutikflow_icon(size):
    scale = 4
    w = size * scale
    h = size * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = int(w * 0.04)
    corner_radius = int(w * 0.22)

    bg_color = (8, 12, 11, 255) # #080c0b
    draw.rounded_rectangle([margin, margin, w - margin, h - margin], radius=corner_radius, fill=bg_color)

    pts_grid = [
        (20, 2),
        (36, 11),
        (36, 29),
        (20, 38),
        (4, 29),
        (4, 11)
    ]
    pts = [((x / 40.0) * w, (y / 40.0) * h) for x, y in pts_grid]

    hex_mask = Image.new("L", (w, h), 0)
    hex_draw = ImageDraw.Draw(hex_mask)
    hex_draw.polygon(pts, fill=255)

    grad_img = Image.new("RGBA", (w, h))
    g_draw = ImageDraw.Draw(grad_img)
    for y_idx in range(h):
        factor = y_idx / float(h)
        r_c = int(109 * (1 - factor) + 49 * factor)
        g_c = int(213 * (1 - factor) + 162 * factor)
        b_c = int(196 * (1 - factor) + 146 * factor)
        g_draw.line([(0, y_idx), (w, y_idx)], fill=(r_c, g_c, b_c, 242))

    img.paste(grad_img, (0, 0), hex_mask)

    wave_draw = ImageDraw.Draw(img)

    def draw_bezier_wave(y_center, stroke_w, color):
        steps = 100
        line_pts = []
        for i in range(steps + 1):
            t = i / float(steps)
            if t <= 0.5:
                ts = t * 2.0
                p0x, p0y = 8.0, y_center
                p1x, p1y = 14.0, y_center - 3.5
                p2x, p2y = 20.0, y_center
                x_g = (1-ts)**2 * p0x + 2*(1-ts)*ts * p1x + ts**2 * p2x
                y_g = (1-ts)**2 * p0y + 2*(1-ts)*ts * p1y + ts**2 * p2y
            else:
                ts = (t - 0.5) * 2.0
                p0x, p0y = 20.0, y_center
                p1x, p1y = 26.0, y_center + 3.5
                p2x, p2y = 32.0, y_center
                x_g = (1-ts)**2 * p0x + 2*(1-ts)*ts * p1x + ts**2 * p2x
                y_g = (1-ts)**2 * p0y + 2*(1-ts)*ts * p1y + ts**2 * p2y

            pixel_x = (x_g / 40.0) * w
            pixel_y = (y_g / 40.0) * h
            line_pts.append((pixel_x, pixel_y))

        wave_draw.line(line_pts, fill=color, width=stroke_w, joint="curve")

    sw_thin = max(2, int(w * 0.028))
    sw_thick = max(3, int(w * 0.042))

    draw_bezier_wave(15.0, sw_thin, (255, 255, 255, 90))
    draw_bezier_wave(20.0, sw_thick, (255, 255, 255, 240))
    draw_bezier_wave(20.0, sw_thick, (245, 158, 11, 140)) # #f59e0b
    draw_bezier_wave(25.0, sw_thin, (255, 255, 255, 90))

    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

public_dir = r"c:\Users\LUXE\Desktop\Boutik-flow-zed\boutik-flow\frontend\public"

sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]

for s in sizes:
    icon_img = create_boutikflow_icon(s)
    if s == 180:
        icon_img.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
        icon_img.save(os.path.join(public_dir, "icon-180.png"), "PNG")
    elif s == 16:
        icon_img.save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")
    elif s == 32:
        icon_img.save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
        icon_img.save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=[(32, 32)])
    
    icon_img.save(os.path.join(public_dir, f"icon-{s}.png"), "PNG")

print("All icons successfully generated!")
