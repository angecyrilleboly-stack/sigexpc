from PIL import Image
import os

logo = Image.open('public/img/logo.png').convert('RGBA')

def make_icon(size, filename, padding_factor=0.93, maskable=False):
    bg_color = (15, 23, 42, 255)  # Bleu fonce SIGEXPC
    if maskable:
        padding_factor = 0.72  # Plus de marge pour maskable
    img = Image.new('RGBA', (size, size), bg_color)
    target = int(size * padding_factor)
    ratio = min(target/logo.width, target/logo.height)
    new_w = int(logo.width * ratio)
    new_h = int(logo.height * ratio)
    logo_resized = logo.resize((new_w, new_h), Image.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    img.paste(logo_resized, (x, y), logo_resized)
    img.save(f'public/img/{filename}')
    print(f'{filename} OK ({size}x{size})')

make_icon(192, 'icon-192.png')
make_icon(512, 'icon-512.png')
make_icon(512, 'icon-maskable-512.png', maskable=True)
print('Toutes les icones generees !')
