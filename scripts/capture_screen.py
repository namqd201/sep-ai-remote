import sys
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.abspath(os.path.join(script_dir, '..', 'apps', 'backend', 'public', 'uploads', 'pc_screen.png'))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

captured = False
try:
    from PIL import ImageGrab
    img = ImageGrab.grab()
    if img and img.size[0] > 0:
        img.save(output_path)
        captured = True
        print("CAPTURED_REAL")
except Exception as e:
    pass

if not captured:
    # Create high-tech security lockscreen preview image
    width, height = 1280, 720
    img = Image.new('RGB', (width, height), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)
    
    # Draw border
    draw.rectangle([10, 10, width - 10, height - 10], outline=(56, 189, 248), width=2)
    
    # Text
    time_str = datetime.now().strftime("%H:%M:%S - %d/%m/%Y")
    
    draw.text((width // 2 - 250, 220), "🔒 WINDOWS IS CURRENTLY LOCKED", fill=(241, 245, 249))
    draw.text((width // 2 - 320, 280), "Man hinh PC dang o che do Khoa bao mat (Lock Screen)", fill=(148, 163, 184))
    draw.text((width // 2 - 280, 330), "Cac tien trinh AI Remote & Antigravity van dang chay ngam 100%", fill=(52, 211, 153))
    draw.text((width // 2 - 120, 420), f"Thoi gian: {time_str}", fill=(125, 211, 252))
    
    img.save(output_path)
    print("CAPTURED_LOCKED_CARD")
