"""
Screen Streamer & Remote Input Daemon for Windows
Provides real-time desktop frame capture and native input emulation.
Communicates via standard JSON over stdin/stdout.
"""

import sys
import json
import time
import io
import base64
import threading
import ctypes
from ctypes import wintypes
from PIL import ImageGrab, Image

# Win32 Constants
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800

VK_MAP = {
    'enter': 0x0D,
    'return': 0x0D,
    'escape': 0x1B,
    'esc': 0x1B,
    'backspace': 0x08,
    'back': 0x08,
    'tab': 0x09,
    'space': 0x20,
    'win': 0x5B,
    'super': 0x5B,
    'shift': 0x10,
    'ctrl': 0x11,
    'control': 0x11,
    'alt': 0x12,
    'menu': 0x12,
    'up': 0x26,
    'down': 0x28,
    'left': 0x25,
    'right': 0x27,
    'delete': 0x2E,
    'del': 0x2E,
    'home': 0x24,
    'end': 0x23,
    'pageup': 0x21,
    'pagedown': 0x22,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74, 'f6': 0x75,
    'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B
}

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ('wVk', ctypes.c_ushort),
        ('wScan', ctypes.c_ushort),
        ('dwFlags', ctypes.c_ulong),
        ('time', ctypes.c_ulong),
        ('dwExtraInfo', ctypes.c_void_p),
    ]

class INPUT_UNION(ctypes.Union):
    _fields_ = [('ki', KEYBDINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [('type', ctypes.c_ulong), ('u', INPUT_UNION)]

def ensure_desktop_attached():
    try:
        hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            return True
    except Exception:
        pass
    return False

def get_screen_resolution():
    w = user32.GetSystemMetrics(0)
    h = user32.GetSystemMetrics(1)
    if w <= 0 or h <= 0:
        w, h = 1920, 1080
    return w, h

def set_mouse_pos(x, y):
    sw, sh = get_screen_resolution()
    # Normalize if given as float 0.0 - 1.0
    if isinstance(x, float) and 0.0 <= x <= 1.0:
        px = int(x * sw)
    else:
        px = int(x)
    if isinstance(y, float) and 0.0 <= y <= 1.0:
        py = int(y * sh)
    else:
        py = int(y)
    
    px = max(0, min(sw - 1, px))
    py = max(0, min(sh - 1, py))
    user32.SetCursorPos(px, py)
    return px, py

def mouse_click(button='left'):
    if button == 'right':
        user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
        time.sleep(0.02)
        user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
    elif button == 'middle':
        user32.mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
        time.sleep(0.02)
        user32.mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
    elif button == 'double':
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        time.sleep(0.02)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        time.sleep(0.08)
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        time.sleep(0.02)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    else:
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        time.sleep(0.02)
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)

def mouse_down(button='left'):
    flag = MOUSEEVENTF_RIGHTDOWN if button == 'right' else MOUSEEVENTF_LEFTDOWN
    user32.mouse_event(flag, 0, 0, 0, 0)

def mouse_up(button='left'):
    flag = MOUSEEVENTF_RIGHTUP if button == 'right' else MOUSEEVENTF_LEFTUP
    user32.mouse_event(flag, 0, 0, 0, 0)

def mouse_scroll(delta):
    # delta is wheel clicks (positive for up, negative for down)
    user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(delta), 0)

def press_key(key_name):
    lower = key_name.lower().strip()
    
    # Handle combinations like 'ctrl+c', 'alt+tab', 'ctrl+shift+esc'
    if '+' in lower:
        parts = [p.strip() for p in lower.split('+')]
        vks = []
        for p in parts:
            if p in VK_MAP:
                vks.append(VK_MAP[p])
            elif len(p) == 1:
                vks.append(ord(p.upper()))
        
        # Press all modifiers and keys down
        for vk in vks:
            user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
        # Release in reverse order
        for vk in reversed(vks):
            user32.keybd_event(vk, 0, 2, 0)
        return

    vk = None
    if lower in VK_MAP:
        vk = VK_MAP[lower]
    elif len(lower) == 1:
        vk = ord(lower.upper())
    
    if vk:
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.02)
        user32.keybd_event(vk, 0, 2, 0)

def type_unicode_text(text):
    for ch in text:
        code = ord(ch)
        if ch == '\n':
            user32.keybd_event(0x0D, 0, 0, 0)
            time.sleep(0.01)
            user32.keybd_event(0x0D, 0, 2, 0)
            continue
        
        inp_down = INPUT(type=1, u=INPUT_UNION(ki=KEYBDINPUT(wVk=0, wScan=code, dwFlags=0x0004, time=0, dwExtraInfo=None)))
        inp_up = INPUT(type=1, u=INPUT_UNION(ki=KEYBDINPUT(wVk=0, wScan=code, dwFlags=0x0004 | 0x0002, time=0, dwExtraInfo=None)))
        inputs = (INPUT * 2)(inp_down, inp_up)
        user32.SendInput(2, ctypes.byref(inputs), ctypes.sizeof(INPUT))
        time.sleep(0.005)

# Streaming Thread Controller
class StreamWorker:
    def __init__(self):
        self.is_active = False
        self.fps = 15
        self.quality = 60
        self.scale = 0.67
        self.thread = None
        self.lock = threading.Lock()
    
    def start(self, fps=15, quality=60, scale=0.67):
        with self.lock:
            self.fps = max(3, min(30, int(fps)))
            self.quality = max(20, min(95, int(quality)))
            self.scale = max(0.2, min(1.0, float(scale)))
            if not self.is_active:
                self.is_active = True
                self.thread = threading.Thread(target=self._run, daemon=True)
                self.thread.start()

    def stop(self):
        with self.lock:
            self.is_active = False

    def update_config(self, fps=None, quality=None, scale=None):
        with self.lock:
            if fps is not None:
                self.fps = max(3, min(30, int(fps)))
            if quality is not None:
                self.quality = max(20, min(95, int(quality)))
            if scale is not None:
                self.scale = max(0.2, min(1.0, float(scale)))

    def _run(self):
        ensure_desktop_attached()
        frame_interval = 1.0 / self.fps
        
        while self.is_active:
            t0 = time.time()
            try:
                ensure_desktop_attached()
                img = ImageGrab.grab()
                
                # Resize
                orig_w, orig_h = img.size
                target_w = int(orig_w * self.scale)
                target_h = int(orig_h * self.scale)
                
                # Make sure even dimensions
                if target_w % 2 != 0: target_w -= 1
                if target_h % 2 != 0: target_h -= 1
                
                if self.scale < 0.98:
                    img = img.resize((target_w, target_h), resample=Image.Resampling.BILINEAR)
                
                # Compress to JPEG
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=self.quality, optimize=False)
                jpeg_bytes = buf.getvalue()
                
                # Output frame as JSON
                b64_str = base64.b64encode(jpeg_bytes).decode('ascii')
                msg = {
                    'event': 'frame',
                    'data': b64_str,
                    'w': target_w,
                    'h': target_h,
                    'origW': orig_w,
                    'origH': orig_h,
                    'ts': int(time.time() * 1000)
                }
                
                sys.stdout.write(json.dumps(msg) + '\n')
                sys.stdout.flush()
            except Exception as e:
                # In case of lock screen or desktop transition
                time.sleep(0.2)
            
            elapsed = time.time() - t0
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

def main():
    ensure_desktop_attached()
    worker = StreamWorker()
    
    # Send ready signal
    sw, sh = get_screen_resolution()
    sys.stdout.write(json.dumps({'event': 'ready', 'screenWidth': sw, 'screenHeight': sh}) + '\n')
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd_data = json.loads(line)
            cmd = cmd_data.get('cmd')
            
            if cmd == 'start':
                worker.start(
                    fps=cmd_data.get('fps', 15),
                    quality=cmd_data.get('quality', 60),
                    scale=cmd_data.get('scale', 0.67)
                )
                sys.stdout.write(json.dumps({'event': 'started'}) + '\n')
                sys.stdout.flush()
                
            elif cmd == 'stop':
                worker.stop()
                sys.stdout.write(json.dumps({'event': 'stopped'}) + '\n')
                sys.stdout.flush()
                
            elif cmd == 'config':
                worker.update_config(
                    fps=cmd_data.get('fps'),
                    quality=cmd_data.get('quality'),
                    scale=cmd_data.get('scale')
                )
                
            elif cmd == 'mouse_move':
                if 'x' in cmd_data and 'y' in cmd_data:
                    px, py = set_mouse_pos(cmd_data['x'], cmd_data['y'])
                    
            elif cmd == 'mouse_click':
                if 'x' in cmd_data and 'y' in cmd_data:
                    set_mouse_pos(cmd_data['x'], cmd_data['y'])
                button = cmd_data.get('button', 'left')
                mouse_click(button)
                
            elif cmd == 'mouse_down':
                if 'x' in cmd_data and 'y' in cmd_data:
                    set_mouse_pos(cmd_data['x'], cmd_data['y'])
                button = cmd_data.get('button', 'left')
                mouse_down(button)
                
            elif cmd == 'mouse_up':
                if 'x' in cmd_data and 'y' in cmd_data:
                    set_mouse_pos(cmd_data['x'], cmd_data['y'])
                button = cmd_data.get('button', 'left')
                mouse_up(button)
                
            elif cmd == 'mouse_scroll':
                if 'x' in cmd_data and 'y' in cmd_data:
                    set_mouse_pos(cmd_data['x'], cmd_data['y'])
                delta = cmd_data.get('delta', 120)
                mouse_scroll(delta)
                
            elif cmd == 'key_press':
                key = cmd_data.get('key', '')
                if key:
                    press_key(key)
                    
            elif cmd == 'type_text':
                text = cmd_data.get('text', '')
                if text:
                    type_unicode_text(text)
                    
            elif cmd == 'ping':
                sys.stdout.write(json.dumps({'event': 'pong'}) + '\n')
                sys.stdout.flush()
                
            elif cmd == 'screen_size':
                sw, sh = get_screen_resolution()
                sys.stdout.write(json.dumps({'event': 'screen_size', 'w': sw, 'h': sh}) + '\n')
                sys.stdout.flush()
                
        except Exception as e:
            sys.stderr.write(f"[StreamerError] {str(e)}\n")
            sys.stderr.flush()

if __name__ == '__main__':
    main()
