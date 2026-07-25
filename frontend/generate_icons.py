#!/usr/bin/env python3
"""
Génère les icônes BF BoutikFlow à partir d'un dégradé horizontal Red -> Yellow -> Green.
Couleurs guinéennes : Rouge #CE1126, Jaune #FCD116, Vert #009460 (de gauche à droite)
Monogramme BF blanc sur hexagone.
"""

import struct, zlib, math, os

def write_png(path, width, height, pixels):
    """Écrit un fichier PNG RGBA depuis une liste de pixels."""
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter byte
        for x in range(width):
            raw += bytes(pixels[y][x])
    
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    
    with open(path, 'wb') as f:
        f.write(png)

def hex_to_rgb(h):
    h = h.lstrip('#')
    return int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)

def lerp(a, b, t):
    return int(a + (b - a) * t)

def lerp_color(c1, c2, t):
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))

def gradient_color_h(x, w):
    """Dégradé horizontal : Rouge (gauche) → Jaune (centre) → Vert (droite)"""
    red    = hex_to_rgb('#CE1126')
    yellow = hex_to_rgb('#FCD116')
    green  = hex_to_rgb('#009460')
    t = x / max(w - 1, 1)
    if t < 0.5:
        return lerp_color(red, yellow, t * 2)
    else:
        return lerp_color(yellow, green, (t - 0.5) * 2)

def point_in_hexagon_pointy(px, py, cx, cy, r):
    """Hexagone pointy-top comme dans le logo."""
    angles = [math.radians(60*i - 90) for i in range(6)]
    verts = [(cx + r*math.cos(a), cy + r*math.sin(a)) for a in angles]
    n = 6
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = verts[i]
        xj, yj = verts[j]
        if ((yi > py) != (yj > py)) and (px < (xj-xi)*(py-yi)/(yj-yi)+xi):
            inside = not inside
        j = i
    return inside

def draw_letter_B(pixels, ox, oy, scale, color, w, h):
    template = [
        "###..",
        "#..#.",
        "#..#.",
        "###..",
        "#..#.",
        "#..#.",
        "###..",
    ]
    pw = max(1, int(2.2 * scale))
    for row, line in enumerate(template):
        for col, ch in enumerate(line):
            if ch == '#':
                for dy in range(pw):
                    for dx in range(pw):
                        ry = oy + row * pw + dy
                        rx = ox + col * pw + dx
                        if 0 <= ry < h and 0 <= rx < w:
                            pixels[ry][rx] = list(color) + [255]

def draw_letter_F(pixels, ox, oy, scale, color, w, h):
    template = [
        "####",
        "#...",
        "#...",
        "###.",
        "#...",
        "#...",
        "#...",
    ]
    pw = max(1, int(2.2 * scale))
    for row, line in enumerate(template):
        for col, ch in enumerate(line):
            if ch == '#':
                for dy in range(pw):
                    for dx in range(pw):
                        ry = oy + row * pw + dy
                        rx = ox + col * pw + dx
                        if 0 <= ry < h and 0 <= rx < w:
                            pixels[ry][rx] = list(color) + [255]

def generate_icon(size, path, maskable=False):
    w = h = size
    pixels = [[[0, 0, 0, 0] for _ in range(w)] for _ in range(h)]
    
    cx = w / 2
    cy = h / 2
    radius = w * 0.46
    
    if maskable:
        for y in range(h):
            for x in range(w):
                pixels[y][x] = [8, 12, 11, 255]
        radius = w * 0.38
    
    # Dessiner l'hexagone avec le dégradé horizontal
    for y in range(h):
        for x in range(w):
            if point_in_hexagon_pointy(x, y, cx, cy, radius):
                r, g, b = gradient_color_h(x, w)
                pixels[y][x] = [r, g, b, 255]
    
    # Contour blanc semi-transparent
    border_r = radius
    border_w = max(1, size // 64)
    for y in range(h):
        for x in range(w):
            in_hex = point_in_hexagon_pointy(x, y, cx, cy, border_r)
            in_inner = point_in_hexagon_pointy(x, y, cx, cy, border_r - border_w * 2)
            if in_hex and not in_inner:
                cur = pixels[y][x]
                pixels[y][x] = [
                    min(255, cur[0] + 40),
                    min(255, cur[1] + 40),
                    min(255, cur[2] + 40),
                    255
                ]
    
    # Texte BF en blanc
    scale = size / 96
    letter_w = int(5 * 2.2 * scale)
    letter_f_w = int(4 * 2.2 * scale)
    total_w = letter_w + int(1.5 * scale) + letter_f_w
    start_x = int(cx - total_w / 2)
    start_y = int(cy - 7 * 2.2 * scale / 2)
    
    white = (255, 255, 255)
    draw_letter_B(pixels, start_x, start_y, scale, white, w, h)
    draw_letter_F(pixels, start_x + letter_w + int(1.5 * scale), start_y, scale, white, w, h)
    
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
    write_png(path, w, h, pixels)
    print(f"OK {path} ({size}x{size})")

if __name__ == '__main__':
    base = "public/icons"
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for s in sizes:
        generate_icon(s, f"{base}/icon-{s}x{s}.png")
    
    for s in [192, 512]:
        generate_icon(s, f"{base}/icon-{s}x{s}-maskable.png", maskable=True)
    
    generate_icon(180, f"public/apple-touch-icon.png")
    generate_icon(32, f"public/favicon-32x32.png")
    generate_icon(16, f"public/favicon-16x16.png")
    
    print("DONE - All icons generated with horizontal Red-Yellow-Green gradient!")
