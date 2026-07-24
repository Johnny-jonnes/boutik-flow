import math
import os
from PIL import Image, ImageDraw

def create_boutikflow_icon(size, maskable=False):
    """
    maskable=True : fond plein couvrant 100% du carré (no padding, no transparency)
    maskable=False : fond arrondi avec transparence (pour favicon et any)
    """
    scale = 4
    w = size * scale
    h = size * scale

    bg_color = (8, 12, 11, 255)  # #080c0b

    if maskable:
        # Fond plein pour maskable — aucune zone blanche visible
        img = Image.new("RGBA", (w, h), bg_color)
    else:
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        corner_radius = int(w * 0.22)
        draw.rounded_rectangle([0, 0, w, h], radius=corner_radius, fill=bg_color)

    # Hexagon avec marge safe pour maskable (80% de la surface)
    if maskable:
        hex_scale = 0.72  # logo occupe 72% de la surface dans la safe zone maskable
    else:
        hex_scale = 0.88

    cx, cy = w / 2, h / 2
    pts_grid = [(20, 2), (36, 11), (36, 29), (20, 38), (4, 29), (4, 11)]
    pts = [
        (
            cx + (x - 20) / 40.0 * w * hex_scale,
            cy + (y - 20) / 40.0 * h * hex_scale
        )
        for x, y in pts_grid
    ]

    # Dégradé hexagone : #6dd5c4 → #31a292
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

    # Ondes fluides dans l'hexagone
    wave_draw = ImageDraw.Draw(img)

    def draw_bezier_wave(y_center_grid, stroke_w, color):
        steps = 120
        line_pts = []
        s = hex_scale
        for i in range(steps + 1):
            t = i / float(steps)
            if t <= 0.5:
                ts = t * 2.0
                p0x, p0y = 9.0, y_center_grid
                p1x, p1y = 14.5, y_center_grid - 3.8
                p2x, p2y = 20.0, y_center_grid
                x_g = (1-ts)**2 * p0x + 2*(1-ts)*ts * p1x + ts**2 * p2x
                y_g = (1-ts)**2 * p0y + 2*(1-ts)*ts * p1y + ts**2 * p2y
            else:
                ts = (t - 0.5) * 2.0
                p0x, p0y = 20.0, y_center_grid
                p1x, p1y = 25.5, y_center_grid + 3.8
                p2x, p2y = 31.0, y_center_grid
                x_g = (1-ts)**2 * p0x + 2*(1-ts)*ts * p1x + ts**2 * p2x
                y_g = (1-ts)**2 * p0y + 2*(1-ts)*ts * p1y + ts**2 * p2y

            pixel_x = cx + (x_g - 20) / 40.0 * w * s
            pixel_y = cy + (y_g - 20) / 40.0 * h * s
            line_pts.append((pixel_x, pixel_y))

        wave_draw.line(line_pts, fill=color, width=stroke_w, joint="curve")

    sw_thin  = max(2, int(w * 0.028 * hex_scale))
    sw_thick = max(3, int(w * 0.045 * hex_scale))

    draw_bezier_wave(15.0, sw_thin,  (255, 255, 255, 88))
    draw_bezier_wave(20.0, sw_thick, (255, 255, 255, 235))
    draw_bezier_wave(20.0, sw_thick, (245, 158, 11,  145))  # amber glow
    draw_bezier_wave(25.0, sw_thin,  (255, 255, 255, 88))

    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

public_dir = r"c:\Users\LUXE\Desktop\Boutik-flow-zed\boutik-flow\frontend\public"

# Tailles à générer
sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]

for s in sizes:
    # Version maskable (fond plein, logo dans la safe zone)
    icon_maskable = create_boutikflow_icon(s, maskable=True)
    icon_maskable.save(os.path.join(public_dir, f"icon-{s}.png"), "PNG")

    # Apple touch icon (180)
    if s == 180:
        icon_maskable.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
        icon_maskable.save(os.path.join(public_dir, "icon-180.png"), "PNG")

# Favicon avec transparence (non-maskable)
for s in [16, 32]:
    icon_fav = create_boutikflow_icon(s, maskable=False)
    if s == 16:
        icon_fav.save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")
    if s == 32:
        icon_fav.save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
        icon_fav.save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=[(32, 32)])

print("✓ Toutes les icônes regenerées sans fond blanc !")
