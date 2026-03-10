"""
Clean console logging utility for Scraper
Provides consistent, organized output formatting
"""

import sys
import os
from datetime import datetime
from typing import Optional

# Fix Windows console encoding for Unicode
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Check if terminal supports Unicode
def _supports_unicode():
    try:
        '🌐'.encode(sys.stdout.encoding or 'utf-8')
        return True
    except (UnicodeEncodeError, LookupError, TypeError):
        return False

USE_UNICODE = _supports_unicode()

def _safe_print(text: str, **kwargs):
    """Print with fallback for encoding errors"""
    try:
        print(text, **kwargs)
    except UnicodeEncodeError:
        # Replace problematic characters with ASCII equivalents
        safe_text = text.encode('ascii', 'replace').decode('ascii')
        print(safe_text, **kwargs)

# ANSI color codes for terminal
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    WHITE = "\033[97m"

# Store icons - Unicode and ASCII fallbacks
STORE_ICONS_UNICODE = {
    "globaliraq": "🌐", "alityan": "🛒", "kolshzin": "🔧",
    "3d-iraq": "🖥️", "jokercenter": "🃏", "spniq": "🕸️",
    "galaxyiq": "🌌", "almanjam": "⛏️", "altajit": "🏪",
}

STORE_ICONS_ASCII = {
    "globaliraq": "[G]", "alityan": "[A]", "kolshzin": "[K]",
    "3d-iraq": "[3D]", "jokercenter": "[J]", "spniq": "[S]",
    "galaxyiq": "[GX]", "almanjam": "[M]", "altajit": "[T]",
}

# Symbols - Unicode and ASCII fallbacks
SYMBOLS = {
    "check": "✓" if USE_UNICODE else "+",
    "cross": "✗" if USE_UNICODE else "X",
    "warning": "⚠" if USE_UNICODE else "!",
    "info": "ℹ" if USE_UNICODE else "i",
    "arrow": "→" if USE_UNICODE else "->",
    "box": "📦" if USE_UNICODE else "[?]",
    "chart": "📊" if USE_UNICODE else "[#]",
}

STORE_ICONS = STORE_ICONS_UNICODE if USE_UNICODE else STORE_ICONS_ASCII

STORE_NAMES = {
    "globaliraq": "GlobalIraq", "alityan": "Alityan", "kolshzin": "Kolshzin",
    "3d-iraq": "3D-Iraq", "jokercenter": "JokerCenter", "spniq": "Spniq",
    "galaxyiq": "Galaxy IQ", "almanjam": "Almanjam", "altajit": "Altajit",
}

def get_store_icon(store: str) -> str:
    return STORE_ICONS.get(store.lower(), SYMBOLS["box"])

def get_store_name(store: str) -> str:
    return STORE_NAMES.get(store.lower(), store)

def header(text: str) -> None:
    width = 60
    _safe_print("")
    _safe_print(f"{Colors.CYAN}{'=' * width}{Colors.RESET}")
    _safe_print(f"{Colors.BOLD}{Colors.CYAN}  {text}{Colors.RESET}")
    _safe_print(f"{Colors.CYAN}{'=' * width}{Colors.RESET}")
    _safe_print("")

def subheader(text: str) -> None:
    _safe_print(f"\n{Colors.BOLD}{Colors.WHITE}> {text}{Colors.RESET}")

def store_start(store: str) -> None:
    icon = get_store_icon(store)
    name = get_store_name(store)
    _safe_print(f"{icon} {Colors.BOLD}{name}{Colors.RESET} {SYMBOLS['arrow']} Scraping...", end="", flush=True)

def store_complete(store: str, count: int, duration: Optional[float] = None) -> None:
    duration_str = f" ({duration:.1f}s)" if duration else ""
    _safe_print(f"\r{get_store_icon(store)} {Colors.BOLD}{get_store_name(store)}{Colors.RESET} {SYMBOLS['arrow']} {Colors.GREEN}{SYMBOLS['check']} {count} products{Colors.RESET}{duration_str}")

def store_failed(store: str, error: str) -> None:
    _safe_print(f"\r{get_store_icon(store)} {Colors.BOLD}{get_store_name(store)}{Colors.RESET} {SYMBOLS['arrow']} {Colors.RED}{SYMBOLS['cross']} Failed{Colors.RESET}")
    _safe_print(f"   {Colors.DIM}{error}{Colors.RESET}")

def category_progress(category: str, count: int) -> None:
    _safe_print(f"   {Colors.DIM}|- {category}: {count}{Colors.RESET}")

def info(message: str) -> None:
    _safe_print(f"{Colors.BLUE}{SYMBOLS['info']}{Colors.RESET}  {message}")

def success(message: str) -> None:
    _safe_print(f"{Colors.GREEN}{SYMBOLS['check']}{Colors.RESET}  {message}")

def warning(message: str) -> None:
    _safe_print(f"{Colors.YELLOW}{SYMBOLS['warning']}{Colors.RESET}  {message}")

def error(message: str) -> None:
    _safe_print(f"{Colors.RED}{SYMBOLS['cross']}{Colors.RESET}  {message}")

def summary(total_products: int, total_stores: int, duration: float) -> None:
    _safe_print("")
    _safe_print(f"{Colors.CYAN}{'-' * 60}{Colors.RESET}")
    _safe_print(f"{Colors.BOLD}{SYMBOLS['chart']} Summary{Colors.RESET}")
    _safe_print(f"   Total Products: {Colors.GREEN}{total_products:,}{Colors.RESET}")
    _safe_print(f"   Stores Scraped: {total_stores}")
    _safe_print(f"   Duration: {duration:.1f}s")
    _safe_print(f"{Colors.CYAN}{'-' * 60}{Colors.RESET}")
    _safe_print("")

def progress_bar(current: int, total: int, width: int = 30) -> str:
    filled = int(width * current / total) if total > 0 else 0
    bar = "#" * filled + "-" * (width - filled)
    percent = (current / total * 100) if total > 0 else 0
    return f"[{bar}] {percent:.0f}%"
