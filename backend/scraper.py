import requests
from typing import List, Dict
import time
from bs4 import BeautifulSoup
import re
import hashlib
from price_utils import parse_price, calculate_discount
import sys

BASE_URL_GLOBAL = "https://globaliraq.net"
BASE_URL_ALITYAN = "https://alityan.com"
BASE_URL_KOLSHZIN = "https://kolshzin.com"
BASE_URL_3DIRAQ = "https://3d-iraq.com"
BASE_URL_JOKERCENTER = "https://www.jokercenter.net"
BASE_URL_SPNIQ = "https://api.spniq.com"
BASE_URL_ALMANJAM = "https://www.almanjam.com"
BASE_URL_ALTAJIT = "https://store.altajit.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate", 
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1"
}

def get_scraper_session(base_url=None):
    session = requests.Session()
    session.headers.update(HEADERS)
    if base_url:
        try:
            # Visit homepage to establish session/cookies
            session.get(base_url, timeout=10)
        except Exception as e:
            print(f"âš ï¸ Failed to visit homepage {base_url}: {e}")
    return session

# -------------------- GlobalIraq Parser --------------------
def parse_globaliraq_product(item: Dict, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_mouse: bool = False, is_keyboard: bool = False, is_power_supply: bool = False, is_case: bool = False, is_storage: bool = False, is_cooler: bool = False, is_monitor: bool = False, is_headset: bool = False, is_laptop: bool = False) -> Dict:
    raw_price = item["variants"][0]["price"]
    raw_compare = item["variants"][0].get("compare_at_price")
    
    # GlobalIraq-specific price parsing (they return full price with .000 at end)
    # Convert "1425000.000" -> "1425000" (remove the decimal part which is always .000)
    def fix_globaliraq_price(price_str):
        if not price_str:
            return price_str
        price_str = str(price_str)
        # GlobalIraq API returns prices like "1425000.000" - remove the .000 part
        if price_str.endswith('.000'):
            return price_str[:-4]  # Remove ".000"
        elif '.' in price_str and price_str.split('.')[-1] == '000':
            return price_str.split('.')[0]  # Take everything before the dot
        return price_str
    
    # Fix the pricing format before parsing
    fixed_price = fix_globaliraq_price(raw_price)
    fixed_compare = fix_globaliraq_price(raw_compare)
    
    # Parse the corrected prices
    price_data = parse_price(fixed_price)
    compare_price_data = parse_price(fixed_compare)
    
    # Only use compare_at_price if it's higher than the current price
    normalized_compare_price = compare_price_data['numeric_value'] if compare_price_data['numeric_value'] > price_data['numeric_value'] else None
    
    # Calculate discount using normalized values
    discount = calculate_discount(normalized_compare_price or 0, price_data['numeric_value']) if normalized_compare_price else 0

    # Detect category from product_type - specifically for GPU detection
    product_type = item.get("product_type", "").lower()
    product_data = {
        "id": f"globaliraq-{item.get('id')}",
        "title": item.get("title"),
        "price": price_data['numeric_value'],
        "old_price": normalized_compare_price,
        "raw_price": price_data['raw_value'],
        "raw_old_price": compare_price_data['raw_value'] if normalized_compare_price else None,
        "detected_currency": price_data['currency'] or compare_price_data['currency'] or 'IQD',
        "discount": discount,
        "image": item["images"][0] if item["images"] else "",
        "link": f"{BASE_URL_GLOBAL}/products/{item.get('handle')}",
        "store": "GlobalIraq",
        "total_sales": item.get("total_sales", 0),
        "in_stock": item["variants"][0].get("available", True) if item.get("variants") else True
    }
    
    # Only add category field for GPUs
    if product_type == "nvidia":
        product_data["category"] = "GPU"
    
    # Add category for RAM (from RAM collections)
    if is_ram:
        product_data["category"] = "RAM"
    
    # Add category for CPU (from CPU collection)
    if is_cpu:
        product_data["category"] = "CPU"
    
    # Add category for Motherboards (from motherboard collection)
    if is_motherboard:
        product_data["category"] = "Motherboards"
    
    # Add category for Mouse (from mouse collection)
    if is_mouse:
        product_data["category"] = "Mouse"
    
    # Add category for Keyboard (from keyboard collection)
    if is_keyboard:
        product_data["category"] = "Keyboard"
    
    # Add category for Power Supply (from power supply collection)
    if is_power_supply:
        product_data["category"] = "Power Supply"
    
    # Add category for Case (from case collection)
    if is_case:
        product_data["category"] = "Case"
    
    # Add category for Storage (from storage collection)
    if is_storage:
        product_data["category"] = "Storage"
    
    # Add category for Cooler (from cooler collection)
    if is_cooler:
        product_data["category"] = "Cooler"
    
    # Add category for Monitor (from monitor collection)
    if is_monitor:
        product_data["category"] = "Monitor"
    
    # Add category for Headset (from headset collection)
    if is_headset:
        product_data["category"] = "Headset"
    
    # Add category for Laptop (from laptop collection)
    if is_laptop:
        product_data["category"] = "Laptop"

    return product_data

# -------------------- Alityan Parser --------------------
def parse_alityan_product(item: Dict, is_gpu: bool = False, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_mouse: bool = False, is_keyboard: bool = False, is_power_supply: bool = False, is_case: bool = False, is_storage: bool = False, is_cooler: bool = False, is_monitor: bool = False, is_headset: bool = False) -> Dict:
    raw_price = item["variants"][0]["price"]
    raw_compare = item["variants"][0].get("compare_at_price")
    
    # Alityan-specific price parsing (handle both formats)
    def fix_alityan_price(price_str):
        if not price_str:
            return price_str
        price_str = str(price_str)
        
        # Check if price ends with .000
        if price_str.endswith('.000'):
            # Split by dot to check format
            parts = price_str.split('.')
            if len(parts) == 2:
                before_dot = parts[0]
                # Long format (5+ digits): "745000.000" -> remove .000
                if len(before_dot) > 4:
                    return before_dot
                # Short format (â‰¤4 digits): "1850.000" -> keep as thousands separator (no change)
                else:
                    return price_str
        return price_str
    
    # Fix the pricing format before parsing
    fixed_price = fix_alityan_price(raw_price)
    fixed_compare = fix_alityan_price(raw_compare)
    
    # Parse the corrected prices
    price_data = parse_price(fixed_price)
    compare_price_data = parse_price(fixed_compare)
    
    # Only use compare_at_price if it's higher than the current price
    normalized_compare_price = compare_price_data['numeric_value'] if compare_price_data['numeric_value'] > price_data['numeric_value'] else None
    
    # Calculate discount using normalized values
    discount = calculate_discount(normalized_compare_price or 0, price_data['numeric_value']) if normalized_compare_price else 0

    product_data = {
        "id": f"alityan-{item.get('id')}",
        "title": item.get("title"),
        "price": price_data['numeric_value'],
        "old_price": normalized_compare_price,
        "raw_price": price_data['raw_value'],
        "raw_old_price": compare_price_data['raw_value'] if normalized_compare_price else None,
        "detected_currency": price_data['currency'] or compare_price_data['currency'] or 'IQD',
        "discount": discount,
        "image": item["images"][0] if item["images"] else "",
        "link": f"{BASE_URL_ALITYAN}/products/{item.get('handle')}",
        "store": "Alityan",
        "total_sales": item.get("total_sales", 0),
        "in_stock": item["variants"][0].get("available", True) if item.get("variants") else True
    }
    
    # Add category for GPUs (from GPU collection)
    if is_gpu:
        product_data["category"] = "GPU"
    
    # Add category for RAM (from RAM collection)
    if is_ram:
        product_data["category"] = "RAM"
    
    # Add category for CPU (from CPU collection)
    if is_cpu:
        product_data["category"] = "CPU"
    
    # Add category for Motherboards (from motherboard collection)
    if is_motherboard:
        product_data["category"] = "Motherboards"
    
    # Add category for Mouse (from mouse collection)
    if is_mouse:
        product_data["category"] = "Mouse"
    
    # Add category for Keyboard (from keyboard collection)
    if is_keyboard:
        product_data["category"] = "Keyboard"
    
    # Add category for Power Supply (from power supply collection)
    if is_power_supply:
        product_data["category"] = "Power Supply"
    
    # Add category for Case (from case collection)
    if is_case:
        product_data["category"] = "Case"
    
    # Add category for Storage (from storage collection)
    if is_storage:
        product_data["category"] = "Storage"
    
    # Add category for Cooler (from cooler collection)
    if is_cooler:
        product_data["category"] = "Cooler"
    
    # Add category for Monitor (from monitor collection)
    if is_monitor:
        product_data["category"] = "Monitor"
    
    # Add category for Headset (from headset collection)
    if is_headset:
        product_data["category"] = "Headset"
    
    return product_data

# -------------------- GlobalIraq Scraper --------------------
def get_ram_from_globaliraq() -> List[Dict]:
    """Fetch RAM directly from GlobalIraq's RAM collection"""
    ram_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/ram-memory/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_ram=True)
                if product:
                    ram_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return ram_products

def get_cpus_from_globaliraq() -> List[Dict]:
    """Fetch CPUs directly from GlobalIraq's processor collection"""
    cpu_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/processor/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_cpu=True)
                if product:
                    cpu_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cpu_products

def get_motherboards_from_globaliraq() -> List[Dict]:
    """Fetch Motherboards directly from GlobalIraq's motherboard collection"""
    motherboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/motherboard/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_motherboard=True)
                if product:
                    motherboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return motherboard_products

def get_mice_from_globaliraq() -> List[Dict]:
    """Fetch Mice directly from GlobalIraq's mouse collection"""
    mouse_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/mice/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_mouse=True)
                if product:
                    mouse_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return mouse_products

def get_keyboards_from_globaliraq() -> List[Dict]:
    """Fetch Keyboards directly from GlobalIraq's keyboard collection"""
    keyboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/keyboards/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_keyboard=True)
                if product:
                    keyboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return keyboard_products

def get_power_supply_from_globaliraq() -> List[Dict]:
    """Fetch Power Supply directly from GlobalIraq's power supply collection"""
    power_supply_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/power-supply/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_power_supply=True)
                if product:
                    power_supply_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return power_supply_products

def get_cases_from_globaliraq() -> List[Dict]:
    """Fetch Cases directly from GlobalIraq's case collection"""
    case_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/case/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_case=True)
                if product:
                    case_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return case_products

def get_storage_from_globaliraq() -> List[Dict]:
    """Fetch Storage directly from GlobalIraq's storage collection"""
    storage_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/storage/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_storage=True)
                if product:
                    storage_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return storage_products

def get_coolers_from_globaliraq() -> List[Dict]:
    """Fetch Coolers directly from GlobalIraq's cooler collection"""
    cooler_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/cooling/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_cooler=True)
                if product:
                    cooler_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cooler_products

def get_monitors_from_globaliraq() -> List[Dict]:
    """Fetch Monitors directly from GlobalIraq's monitor collection"""
    monitor_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/monitor/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_monitor=True)
                if product:
                    monitor_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return monitor_products

def get_headsets_from_globaliraq() -> List[Dict]:
    """Fetch Headsets directly from GlobalIraq's headset collection"""
    headset_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/headsets/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_globaliraq_product(item, is_headset=True)
                if product:
                    headset_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return headset_products

def get_products_from_globaliraq() -> List[Dict]:
    products = []
    
    print("ðŸŒ GlobalIraq: Starting...")
    
    # Get all products from collections
    ram_products = get_ram_from_globaliraq()
    products.extend(ram_products)
    
    cpu_products = get_cpus_from_globaliraq()
    products.extend(cpu_products)
    
    motherboard_products = get_motherboards_from_globaliraq()
    products.extend(motherboard_products)
    
    mouse_products = get_mice_from_globaliraq()
    products.extend(mouse_products)
    
    keyboard_products = get_keyboards_from_globaliraq()
    products.extend(keyboard_products)
    
    power_supply_products = get_power_supply_from_globaliraq()
    products.extend(power_supply_products)
    
    case_products = get_cases_from_globaliraq()
    products.extend(case_products)
    
    storage_products = get_storage_from_globaliraq()
    products.extend(storage_products)
    
    cooler_products = get_coolers_from_globaliraq()
    products.extend(cooler_products)
    
    monitor_products = get_monitors_from_globaliraq()
    products.extend(monitor_products)
    
    headset_products = get_headsets_from_globaliraq()
    products.extend(headset_products)
    
    laptop_products = get_laptop_from_globaliraq()
    products.extend(laptop_products)
    
    # Get other products from general collection
    page = 1
    while True:
        url = f"{BASE_URL_GLOBAL}/collections/all/products.json?sort_by=best-selling&page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        # Track RAM, CPU, Motherboard, Mouse, Keyboard, Power Supply, Case, Storage, Cooler, Monitor, Headset, Laptop IDs to avoid duplicates
        ram_ids = {ram.get('id', '').replace('globaliraq-', '') for ram in ram_products}
        cpu_ids = {cpu.get('id', '').replace('globaliraq-', '') for cpu in cpu_products}
        motherboard_ids = {mb.get('id', '').replace('globaliraq-', '') for mb in motherboard_products}
        mouse_ids = {mouse.get('id', '').replace('globaliraq-', '') for mouse in mouse_products}
        keyboard_ids = {keyboard.get('id', '').replace('globaliraq-', '') for keyboard in keyboard_products}
        power_supply_ids = {psu.get('id', '').replace('globaliraq-', '') for psu in power_supply_products}
        case_ids = {case.get('id', '').replace('globaliraq-', '') for case in case_products}
        storage_ids = {storage.get('id', '').replace('globaliraq-', '') for storage in storage_products}
        cooler_ids = {cooler.get('id', '').replace('globaliraq-', '') for cooler in cooler_products}
        monitor_ids = {monitor.get('id', '').replace('globaliraq-', '') for monitor in monitor_products}
        headset_ids = {headset.get('id', '').replace('globaliraq-', '') for headset in headset_products}
        laptop_ids = {laptop.get('id', '').replace('globaliraq-', '') for laptop in laptop_products}
        excluded_ids = ram_ids | cpu_ids | motherboard_ids | mouse_ids | keyboard_ids | power_supply_ids | case_ids | storage_ids | cooler_ids | monitor_ids | headset_ids | laptop_ids
        
        for item in data:
            # Skip if this product is already in our specialized collections
            if str(item.get('id', '')) in excluded_ids:
                continue
                
            try:
                product = parse_globaliraq_product(item, is_ram=False, is_cpu=False, is_motherboard=False)
                if product:
                    products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return products

# -------------------- Alityan Scraper --------------------
def get_gpus_from_alityan(session) -> List[Dict]:
    """Fetch GPUs directly from Alityan's GPU collection"""
    gpus = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/gpus/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_gpu=True)
                if product:
                    gpus.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return gpus

def get_ram_from_alityan(session) -> List[Dict]:
    """Fetch RAM directly from Alityan's RAM collection"""
    ram_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/ram/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_ram=True)
                if product:
                    ram_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return ram_products

def get_cpus_from_alityan(session) -> List[Dict]:
    """Fetch CPUs directly from Alityan's CPU collection"""
    cpu_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/amd/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_cpu=True)
                if product:
                    cpu_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cpu_products

def get_motherboards_from_alityan(session) -> List[Dict]:
    """Fetch Motherboards directly from Alityan's motherboards collection"""
    motherboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/motherboards/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_motherboard=True)
                if product:
                    motherboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return motherboard_products

def get_mice_from_alityan(session) -> List[Dict]:
    """Fetch Mice directly from Alityan's mouse collection"""
    mouse_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/mouses/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_mouse=True)
                if product:
                    mouse_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return mouse_products

def get_keyboards_from_alityan(session) -> List[Dict]:
    """Fetch Keyboards directly from Alityan's keyboard collection"""
    keyboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/keyboards/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_keyboard=True)
                if product:
                    keyboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return keyboard_products

def get_power_supply_from_alityan(session) -> List[Dict]:
    """Fetch Power Supply directly from Alityan's power supply collection"""
    power_supply_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/power-supply/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_power_supply=True)
                if product:
                    power_supply_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return power_supply_products

def get_cases_from_alityan(session) -> List[Dict]:
    """Fetch Cases directly from Alityan's case collection"""
    case_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/case/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_case=True)
                if product:
                    case_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return case_products

def get_storage_from_alityan(session) -> List[Dict]:
    """Fetch Storage directly from Alityan's storage collection"""
    storage_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/storage/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_storage=True)
                if product:
                    storage_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return storage_products

def get_coolers_from_alityan(session) -> List[Dict]:
    """Fetch Coolers directly from Alityan's cooler collection"""
    cooler_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/coolers/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_cooler=True)
                if product:
                    cooler_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cooler_products

def get_monitors_from_alityan(session) -> List[Dict]:
    """Fetch Monitors directly from Alityan's monitor collection"""
    monitor_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/moniter/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_monitor=True)
                if product:
                    monitor_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return monitor_products

def get_headsets_from_alityan(session) -> List[Dict]:
    """Fetch Headsets directly from Alityan's headset collection"""
    headset_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/headsets/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_alityan_product(item, is_headset=True)
                if product:
                    headset_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return headset_products

def get_products_from_alityan() -> List[Dict]:
    products = []
    
    print("ðŸ›’ Alityan: Starting...")
    
    # Initialize session with robust headers and visit homepage
    session = get_scraper_session(BASE_URL_ALITYAN)
    
    # Get all products from collections
    gpu_products = get_gpus_from_alityan(session)
    products.extend(gpu_products)
    
    ram_products = get_ram_from_alityan(session)
    products.extend(ram_products)
    
    cpu_products = get_cpus_from_alityan(session)
    products.extend(cpu_products)
    
    motherboard_products = get_motherboards_from_alityan(session)
    products.extend(motherboard_products)
    
    mouse_products = get_mice_from_alityan(session)
    products.extend(mouse_products)
    
    keyboard_products = get_keyboards_from_alityan(session)
    products.extend(keyboard_products)
    
    power_supply_products = get_power_supply_from_alityan(session)
    products.extend(power_supply_products)
    
    case_products = get_cases_from_alityan(session)
    products.extend(case_products)
    
    storage_products = get_storage_from_alityan(session)
    products.extend(storage_products)
    
    cooler_products = get_coolers_from_alityan(session)
    products.extend(cooler_products)
    
    monitor_products = get_monitors_from_alityan(session)
    products.extend(monitor_products)
    
    headset_products = get_headsets_from_alityan(session)
    products.extend(headset_products)
    
    # Get other products from general collection
    page = 1
    while True:
        url = f"{BASE_URL_ALITYAN}/collections/all/products.json?sort_by=best-selling&page={page}"
        res = session.get(url)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        # Track GPU, RAM, CPU, Motherboard, Mouse, Keyboard, Power Supply, Case, Storage, Cooler, Monitor, Headset IDs to avoid duplicates
        gpu_ids = {gpu.get('id', '').replace('alityan-', '') for gpu in gpu_products}
        ram_ids = {ram.get('id', '').replace('alityan-', '') for ram in ram_products}
        cpu_ids = {cpu.get('id', '').replace('alityan-', '') for cpu in cpu_products}
        motherboard_ids = {mb.get('id', '').replace('alityan-', '') for mb in motherboard_products}
        mouse_ids = {mouse.get('id', '').replace('alityan-', '') for mouse in mouse_products}
        keyboard_ids = {keyboard.get('id', '').replace('alityan-', '') for keyboard in keyboard_products}
        power_supply_ids = {psu.get('id', '').replace('alityan-', '') for psu in power_supply_products}
        case_ids = {case.get('id', '').replace('alityan-', '') for case in case_products}
        storage_ids = {storage.get('id', '').replace('alityan-', '') for storage in storage_products}
        cooler_ids = {cooler.get('id', '').replace('alityan-', '') for cooler in cooler_products}
        monitor_ids = {monitor.get('id', '').replace('alityan-', '') for monitor in monitor_products}
        headset_ids = {headset.get('id', '').replace('alityan-', '') for headset in headset_products}
        excluded_ids = gpu_ids | ram_ids | cpu_ids | motherboard_ids | mouse_ids | keyboard_ids | power_supply_ids | case_ids | storage_ids | cooler_ids | monitor_ids | headset_ids
        
        for item in data:
            # Skip if this product is already in our specialized collections
            if str(item.get('id', '')) in excluded_ids:
                continue
                
            try:
                product = parse_alityan_product(item, is_gpu=False, is_ram=False, is_cpu=False, is_motherboard=False)
                if product:
                    products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return products

# -------------------- Kolshzin Category Extraction --------------------
def extract_kolshzin_products_from_page(soup, is_laptop=False):
    """Extract products from a Kolshzin page"""
    products = []
    seen_links = set()
    
    for p in soup.select("li.product"):
        title_el = p.select_one("h2.woocommerce-loop-product__title a") or p.select_one("a.woocommerce-LoopProduct-link")
        new_price_el = p.select_one(".price .amount") or p.select_one(".price")
        old_price_el = p.select_one("del .amount")

        title = title_el.text.strip() if title_el else "Unknown"
        new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
        old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

        price_data = parse_price(new_price_text)
        compare_price_data = parse_price(old_price_text) if old_price_text else None
        
        price = price_data['numeric_value']
        old_price = compare_price_data['numeric_value'] if compare_price_data else None
        
        normalized_compare_price = None
        if compare_price_data and compare_price_data['numeric_value'] > price:
            normalized_compare_price = old_price
        
        discount = calculate_discount(normalized_compare_price or 0, price) if normalized_compare_price else 0

        img_el = p.select_one("img")
        image_url = img_el.get("data-src") or img_el.get("src") if img_el else ""

        stock_el = p.select_one("p.stock.out-of-stock")
        in_stock = stock_el is None

        # Set category based on is_laptop flag
        category = "Laptop" if is_laptop else extract_kolshzin_category(p)

        product_link = title_el["href"] if title_el else ""
        if product_link and product_link in seen_links:
            continue
        seen_links.add(product_link)

        products.append({
            "id": f"kolshzin-{hashlib.md5(f'{title}_kolshzin'.encode()).hexdigest()[:16]}",
            "title": title,
            "price": price,
            "old_price": normalized_compare_price,
            "raw_price": new_price_text,
            "raw_old_price": old_price_text if normalized_compare_price else None,
            "detected_currency": 'IQD',
            "discount": discount,
            "image": image_url,
            "link": product_link,
            "store": "Kolshzin",
            "in_stock": in_stock,
            "category": category
        })
    
    return products

def extract_kolshzin_category(product_element):
    """Extract category from Kolshzin product HTML class attributes"""
    classes = product_element.get('class', [])
    
    for cls in classes:
        if cls.startswith('product_cat-'):
            # Extract category slug
            category_slug = cls.replace('product_cat-', '')
            
            # Map to clean category names
            category_mapping = {
                # Graphics Cards (all brands) - Found from actual Kolshzin categories
                'zotac-graphics-cards': 'GPU',
                'pny-graphics-cards': 'GPU', 
                'asus-graphics-cards': 'GPU',
                'msi-graphics-cards': 'GPU',
                'nvidia-graphics-cards': 'GPU',
                'amd-graphics-cards': 'GPU',
                'gigabyte-graphics-cards': 'GPU',
                'gigabyte-gpu': 'GPU',
                'graphics-cards': 'GPU',
                'graphics-cards-msi': 'GPU',
                'galax-graphics-cards': 'GPU',
                'galax-gpu': 'GPU',
                'galax-gpus': 'GPU',
                'gpu-galax': 'GPU',
                'aorus-graphics-cards': 'GPU',
                'aorus-gpus': 'GPU',
                'gigabyte-aorus': 'GPU',
                
                # RAM/Memory (all types and brands)
                'ram-ddr4': 'RAM',
                'ram-ddr5': 'RAM', 
                'corsair-ram': 'RAM',
                'gskill-ram': 'RAM',
                'memory-ram': 'RAM',
                'ddr4-memory': 'RAM',
                'ddr5-memory': 'RAM',
                'product_cat-ram-ddr5': 'RAM',
                'product_cat-corsair-ram': 'RAM', 
                'product_cat-ram-ddr4': 'RAM',
                'product_cat-g-skill-ram': 'RAM',
                'product_cat-memory-ram': 'RAM',
                'product_cat-adata': 'RAM',
                
                # Motherboards (all brands)
                'msi-motherboards': 'Motherboards',
                'asus-mb': 'Motherboards',
                'asus-motherboards': 'Motherboards',
                'gigabyte-motherboards': 'Motherboards',
                'gigabyte-mb': 'Motherboards',
                'gigabyte-mainboard': 'Motherboards',
                'gigabyte-motherboard': 'Motherboards',
                'asrock-motherboards': 'Motherboards',
                'motherboards': 'Motherboards',
                'motherboard': 'Motherboards',
                'mainboard': 'Motherboards',
                'mainboards': 'Motherboards',
                
                # Storage
                'ssd-drive': 'Storage',
                'hdd-drive': 'Storage',
                'samsung-ssd': 'Storage',
                'storage': 'Storage',
                'nvme-ssd': 'Storage',
                
                # Power Supply
                'pc-power-supply-unit': 'Power Supply',
                'power-supply': 'Power Supply',
                'psu': 'Power Supply',
                
                # Cases
                'xigmatek-cases': 'Case',
                'pc-cases': 'Case',
                'cases': 'Case',
                'computer-cases': 'Case',
                
                # Cooling
                'cooling': 'Cooler',
                'cpu-coolers': 'Cooler',
                'liquid-cooling': 'Cooler',
                'fans': 'Cooler',
                
                # Peripherals
                'input-devices': 'Peripherals',
                'keyboards': 'Peripherals',
                'mice': 'Peripherals',
                'headsets': 'Peripherals',
                'gaming-peripherals': 'Peripherals',
                
                # Monitors
                'monitors': 'Monitors',
                'gaming-monitors': 'Monitors',
                'lcd-monitors': 'Monitors',
                
                # CPU/Processors
                'processors': 'CPU',
                'intel-processors': 'CPU',
                'amd-processors': 'CPU',
                'cpu': 'CPU'
            }
            
            return category_mapping.get(category_slug, 'Other')
    
    return 'Other'

# -------------------- Kolshzin Scraper --------------------
def get_products_from_kolshzin() -> List[Dict]:
    products = []
    seen_links = set()
    
    print("ðŸ”§ Kolshzin: Starting...")
    
    categories = [
        {"url": f"{BASE_URL_KOLSHZIN}/product-category/hardware-components/pc-components/", "force_category": None},
        {"url": "https://kolshzin.com/product-category/%d9%85%d9%86%d8%aa%d8%ac%d8%a7%d8%aa-%d8%ba%d9%8a%d8%ba%d8%a7%d8%a8%d8%a7%d9%8a%d8%aa-gigabyte-iraq/", "force_category": None},
        {"url": "https://kolshzin.com/product-category/computer-office/input-devices/keyboards/", "force_category": "Keyboard"},
        {"url": "https://kolshzin.com/product-category/computer-office/input-devices/mouse/", "force_category": "Mouse"},
        {"url": "https://kolshzin.com/product-category/hardware-components/cooling/", "force_category": "Cooler"},
        {"url": "https://kolshzin.com/product-category/%d9%85%d9%86%d8%aa%d8%ac%d8%a7%d8%aa-%d8%b3%d8%a7%d9%85%d8%b3%d9%88%d9%86%d8%ac-samsung-%d8%a7%d9%84%d8%b9%d8%b1%d8%a7%d9%82/%d8%b4%d8%a7%d8%b4%d8%a7%d8%aa-%d8%b3%d8%a7%d9%85%d8%b3%d9%88%d9%86%d8%ac-samsung/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/asus/asus-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/%d9%85%d9%86%d8%aa%d8%ac%d8%a7%d8%aa-%d8%ba%d9%8a%d8%ba%d8%a7%d8%a8%d8%a7%d9%8a%d8%aa-gigabyte-iraq/gigabyte-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/msi-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/lg-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/monitor-holders-stands/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/hisense-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/dell-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/hp-monitors/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/xiaomi-tvs/", "force_category": "Monitor"},
        {"url": "https://kolshzin.com/product-category/computer-office/computer-headphones/", "force_category": "Headset"},
        {"url": "https://kolshzin.com/product-category/steelseries/", "force_category": "Headset"},
        {"url": "https://kolshzin.com/product-category/laptops/", "force_category": "Laptop"}
    ]
    
    # REMOVED PC-COMPONENTS SPECIFIC URLS FOR TESTING CSS AUTO-DETECTION:
    # {"url": "https://kolshzin.com/product-category/hardware-components/pc-components/pc-power-supply-unit/", "force_category": "Power Supply"},
    # {"url": "https://kolshzin.com/product-category/hardware-components/pc-components/cases/", "force_category": "Case"},  
    # {"url": "https://kolshzin.com/product-category/hardware-components/pc-components/ssd-drive/?per_page=150", "force_category": "Storage"},
    # {"url": "https://kolshzin.com/product-category/hardware-components/pc-components/hdd-drive/?per_page=150", "force_category": "Storage"}
    
    for i, category in enumerate(categories, 1):
        category_url = category["url"]
        force_category = category["force_category"]
        page = 1
        last_html = None

        while True:
            url = f"{category_url}?_ajax_get_product=1&paged={page}&per_page=150"
            res = requests.get(url, headers=HEADERS)
            html = res.text.strip()
            if html == last_html:
                break
            last_html = html

            soup = BeautifulSoup(html, "html.parser")
            items = soup.select(".product-grid-item")
            if not items:
                break

            for p in items:
                title_el = p.select_one("h3 a")
                new_price_el = p.select_one(".price ins bdi") or p.select_one(".price bdi")
                old_price_el = p.select_one("del bdi")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                price_data = parse_price(new_price_text)
                compare_price_data = parse_price(old_price_text) if old_price_text else None
                
                price = price_data['numeric_value']
                old_price = compare_price_data['numeric_value'] if compare_price_data else None
                
                normalized_compare_price = None
                if compare_price_data and compare_price_data['numeric_value'] > price:
                    normalized_compare_price = old_price
                
                discount = calculate_discount(normalized_compare_price or 0, price) if normalized_compare_price else 0

                img_el = p.select_one("img")
                image_url = img_el.get("data-src") or img_el.get("src") if img_el else ""

                stock_el = p.select_one("p.stock.out-of-stock")
                in_stock = stock_el is None

                # Use force_category if specified, otherwise detect from CSS
                if force_category:
                    category = force_category
                else:
                    category = extract_kolshzin_category(p)

                product_link = title_el["href"] if title_el else ""
                if product_link and product_link in seen_links:
                    continue
                seen_links.add(product_link)

                products.append({
                    "id": f"kolshzin-{hashlib.md5(f'{title}_kolshzin'.encode()).hexdigest()[:16]}",
                    "title": title,
                    "price": price,
                    "old_price": normalized_compare_price,
                    "raw_price": new_price_text,
                    "raw_old_price": old_price_text if normalized_compare_price else None,
                    "detected_currency": 'IQD',
                    "discount": discount,
                    "store": "Kolshzin",
                    "link": product_link,
                    "image": image_url,
                    "in_stock": in_stock,
                    "category": category
                })
            
            page += 1
            time.sleep(0.3)
    
    return products

# -------------------- JokerCenter Parser --------------------

def parse_spniq_product(item: Dict, is_gpu: bool = False, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_mouse: bool = False, is_keyboard: bool = False, is_power_supply: bool = False, is_case: bool = False, is_storage: bool = False, is_cooler: bool = False, is_monitor: bool = False, is_headset: bool = False, is_laptop: bool = False) -> Dict:
    """Parse a single product from spniq API response"""
    try:
        # Extract product data from spniq API format
        product_id = item.get('_id', '')
        title = item.get('title', 'Untitled Product')
        description = item.get("short_description", "")
        vendor = item.get("vendor", "")
        stock = item.get("stock", 0)

        # Handle pricing - spniq uses complex price structure
        raw_price = 0  # Default to 0
        if item.get("price") and isinstance(item["price"], list) and len(item["price"]) > 0:
            # Price is in array format: [{"key": "0", "value": 270000, "images": [...]}]
            raw_price = item["price"][0].get("value", 0)
        else:
            # Fallback for non-list price data
            price_val = item.get("price", 0)
            raw_price = price_val if price_val is not None else 0
        
        # Ensure raw_price is never None
        if raw_price is None:
            raw_price = 0
        
        # Normalize spniq placeholder prices: treat price 1-2 as out of stock
        if 1 <= raw_price <= 2:
            raw_price = 0
        
        price_data = parse_price(raw_price)
        
        # Handle images from price array or root images
        image_url = ""
        if item.get("price") and isinstance(item["price"], list) and len(item["price"]) > 0:
            # Images in price object
            images_data = item["price"][0].get("images", [])
            if images_data:
                if isinstance(images_data, list) and len(images_data) > 0:
                    # Images are now in list format: ['/media/lD8rvso3eXjH.png', '/media/aKRk3Ua6pg3W.png']
                    first_image = images_data[0]
                elif isinstance(images_data, str):
                    # Fallback for old string format: "/media/lD8rvso3eXjH.png /media/aKRk3Ua6pg3W.png"
                    first_image = images_data.split()[0] if images_data else ""
                else:
                    first_image = ""
                
                if first_image and not first_image.startswith("http"):
                    image_url = "https://api.spniq.com" + first_image
        
        # Fallback to root images if available
        if not image_url and item.get("images"):
            first_image = item["images"][0] if item["images"] else ""
            if first_image and not first_image.startswith("http"):
                image_url = "https://api.spniq.com" + first_image

        # Create product data structure
        product_data = {
            "id": f"spniq-{product_id}",
            "title": title,
            "price": price_data['numeric_value'],
            "old_price": None,
            "raw_price": str(raw_price),
            "raw_old_price": None,
            "detected_currency": price_data.get('currency') or 'IQD',
            "discount": 0,
            "image": image_url,
            "link": f"https://spniq.com/product/{title.lower().replace(' ', '_').replace('™', '').replace('®', '')}_{product_id}",
            "store": "spniq",
            "in_stock": stock > 0 and price_data['numeric_value'] > 0,
            "total_sales": 0,
            "short_description": description,
            "vendor": vendor,
            "category": "General"
        }

        # Set category based on flags
        if is_gpu:
            product_data["category"] = "GPU"
        elif is_ram:
            product_data["category"] = "RAM"
        elif is_cpu:
            product_data["category"] = "CPU"
        elif is_motherboard:
            product_data["category"] = "Motherboards"
        elif is_mouse:
            product_data["category"] = "Mouse"
        elif is_keyboard:
            product_data["category"] = "Keyboard"
        elif is_power_supply:
            product_data["category"] = "Power Supply"
        elif is_case:
            product_data["category"] = "Case"
        elif is_storage:
            product_data["category"] = "Storage"
        elif is_cooler:
            product_data["category"] = "Cooler"
        elif is_monitor:
            product_data["category"] = "Monitor"
        elif is_headset:
            product_data["category"] = "Headset"

        return product_data

    except Exception as e:
        print(f"Error parsing spniq product: {e}")
        return None

def parse_jokercenter_product(item: Dict, is_gpu: bool = False, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_mouse: bool = False, is_keyboard: bool = False, is_power_supply: bool = False, is_case: bool = False, is_storage: bool = False, is_cooler: bool = False, is_monitor: bool = False, is_headset: bool = False) -> Dict:
    """Parse a single product from JokerCenter API response"""
    try:
        # Extract product data from JokerCenter API format
        product_id = str(item.get("id", ""))
        title = item.get("name", "Unknown Product")
        price = item.get("price", 0)
        discount_percentage = item.get("discount", 0) or 0  # Convert None to 0
        description = item.get("description", "")
        image_url = item.get("imageUrl", "")
        images = item.get("images", [])
        quantity = item.get("quantity", 0)
        category = item.get("category", "")

        # Handle pricing and discounts
        if isinstance(price, (int, float)):
            current_price = int(price)
            # Calculate original price if there's a discount
            if isinstance(discount_percentage, (int, float)) and discount_percentage > 0:
                original_price = int(current_price / (1 - discount_percentage / 100))
            else:
                original_price = current_price
        else:
            current_price = 0
            original_price = 0

        # Handle image URL
        if image_url and not image_url.startswith("http"):
            image_url = BASE_URL_JOKERCENTER + image_url

        # Create product data structure
        product_data = {
            "id": f"jokercenter-{product_id}",
            "title": title,
            "price": current_price,
            "currency": "IQD",
            "image": image_url,
            "link": f"{BASE_URL_JOKERCENTER}/products/{product_id}",
            "store": "JokerCenter",
            "in_stock": quantity > 0,
            "description": description[:200] + "..." if len(description) > 200 else description,
            "category": "General"
        }
        
        # Add discount information if available
        if isinstance(discount_percentage, (int, float)) and discount_percentage > 0:
            product_data["old_price"] = original_price
            product_data["discount_percentage"] = discount_percentage

        # Set category based on flags
        if is_gpu:
            product_data["category"] = "GPU"
        elif is_ram:
            product_data["category"] = "RAM"
        elif is_cpu:
            product_data["category"] = "CPU"
        elif is_motherboard:
            product_data["category"] = "Motherboards"
        elif is_mouse:
            product_data["category"] = "Mouse"
        elif is_keyboard:
            product_data["category"] = "Keyboard"
        elif is_power_supply:
            product_data["category"] = "Power Supply"
        elif is_case:
            product_data["category"] = "Case"
        elif is_storage:
            product_data["category"] = "Storage"
        elif is_cooler:
            product_data["category"] = "Cooler"
        elif is_monitor:
            product_data["category"] = "Monitor"
        elif is_headset:
            product_data["category"] = "Headset"

        return product_data

    except Exception as e:
        print(f"Error parsing JokerCenter product: {e}")
        return None

# -------------------- JokerCenter Scrapers --------------------

def get_gpu_from_jokercenter() -> List[Dict]:
    """Fetch Graphics Cards from JokerCenter API"""
    gpu_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Graphics Cards&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_gpu=True)
                if product:
                    gpu_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return gpu_products

def get_cpu_from_jokercenter() -> List[Dict]:
    """Fetch CPUs from JokerCenter API"""
    cpu_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=CPUs&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_cpu=True)
                if product:
                    cpu_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cpu_products

def get_motherboards_from_jokercenter() -> List[Dict]:
    """Fetch Motherboards from JokerCenter API"""
    motherboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Motherboards&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_motherboard=True)
                if product:
                    motherboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return motherboard_products

def get_storage_from_jokercenter() -> List[Dict]:
    """Fetch Storage from JokerCenter API"""
    storage_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Storage&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_storage=True)
                if product:
                    storage_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return storage_products

def get_cases_from_jokercenter() -> List[Dict]:
    """Fetch Cases from JokerCenter API"""
    case_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Cases&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_case=True)
                if product:
                    case_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return case_products

def get_power_supply_from_jokercenter() -> List[Dict]:
    """Fetch Power Supplies from JokerCenter API"""
    psu_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Power Supplies&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_power_supply=True)
                if product:
                    psu_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return psu_products

def get_coolers_from_jokercenter() -> List[Dict]:
    """Fetch Coolers from JokerCenter API"""
    cooler_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Coolers&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_cooler=True)
                if product:
                    cooler_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cooler_products

def get_keyboards_from_jokercenter() -> List[Dict]:
    """Fetch Keyboards from JokerCenter API"""
    keyboard_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Keyboards&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_keyboard=True)
                if product:
                    keyboard_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return keyboard_products

def get_mice_from_jokercenter() -> List[Dict]:
    """Fetch Mice from JokerCenter API"""
    mouse_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Mice&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_mouse=True)
                if product:
                    mouse_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return mouse_products

def get_monitors_from_jokercenter() -> List[Dict]:
    """Fetch Monitors from JokerCenter API - multiple categories"""
    monitor_products = []
    
    # Monitor categories to scrape
    monitor_categories = ["OLED Monitor", "Gaming Monitor", "Monitor Arm"]
    
    for category in monitor_categories:
        page = 1
        while True:
            url = f"{BASE_URL_JOKERCENTER}/api/products?category={category}&page={page}&limit=50"
            res = requests.get(url, headers=HEADERS)
            if res.status_code != 200:
                break
            
            data = res.json().get("products", [])
            if not data:
                break
            
            for item in data:
                try:
                    product = parse_jokercenter_product(item, is_monitor=True)
                    if product:
                        monitor_products.append(product)
                except Exception as e:
                    continue
            
            page += 1
            time.sleep(0.3)
    
    return monitor_products

def get_headsets_from_jokercenter() -> List[Dict]:
    """Fetch Headsets from JokerCenter API"""
    headset_products = []
    page = 1
    
    while True:
        url = f"{BASE_URL_JOKERCENTER}/api/products?category=Headsets&page={page}&limit=50"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        data = res.json().get("products", [])
        if not data:
            break
        
        for item in data:
            try:
                product = parse_jokercenter_product(item, is_headset=True)
                if product:
                    headset_products.append(product)
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return headset_products

def get_products_from_jokercenter() -> List[Dict]:
    """Main function to get all products from JokerCenter"""
    products = []
    
    print("ðŸƒ JokerCenter: Starting...", flush=True)
    
    # Moved print statement to beginning of function
    
    # Get products from all categories
    gpu_products = get_gpu_from_jokercenter()
    products.extend(gpu_products)
    
    cpu_products = get_cpu_from_jokercenter()
    products.extend(cpu_products)
    
    motherboard_products = get_motherboards_from_jokercenter()
    products.extend(motherboard_products)
    
    storage_products = get_storage_from_jokercenter()
    products.extend(storage_products)
    
    case_products = get_cases_from_jokercenter()
    products.extend(case_products)
    
    power_supply_products = get_power_supply_from_jokercenter()
    products.extend(power_supply_products)
    
    cooler_products = get_coolers_from_jokercenter()
    products.extend(cooler_products)
    
    keyboard_products = get_keyboards_from_jokercenter()
    products.extend(keyboard_products)
    
    mouse_products = get_mice_from_jokercenter()
    products.extend(mouse_products)
    
    monitor_products = get_monitors_from_jokercenter()
    products.extend(monitor_products)
    
    headset_products = get_headsets_from_jokercenter()
    products.extend(headset_products)
    
    return products

# -------------------- spniq Scrapers --------------------

def get_gpu_from_spniq() -> List[Dict]:
    """Fetch Graphics Cards from spniq API"""
    gpu_products = []
    
    try:
        # Get all categories first
        url = f"{BASE_URL_SPNIQ}/categories"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            print(f"Error fetching spniq categories: HTTP {res.status_code}")
            return []
        
        categories = res.json()
        if not isinstance(categories, list):
            print("spniq API returned unexpected format")
            return []
        
        # Find the GPU category
        gpu_category = None
        for category in categories:
            if category.get("title") == "Graphics Card":
                gpu_category = category
                break
        
        if not gpu_category:
            print("No Graphics Card category found in spniq API")
            return []
        
        # Process GPU products
        products = gpu_category.get("products", [])
        for item in products:
            try:
                product = parse_spniq_product(item, is_gpu=True)
                if product:
                    gpu_products.append(product)
            except Exception as e:
                continue
        
        time.sleep(0.3)
        
    except Exception as e:
        print(f"Error fetching spniq graphics cards: {e}")
    
    return gpu_products

def get_cpu_from_spniq() -> List[Dict]:
    """Fetch CPUs from spniq API"""
    return get_spniq_category_products("CPU", is_cpu=True)

def get_storage_from_spniq() -> List[Dict]:
    """Fetch Storage devices from spniq API"""
    return get_spniq_category_products("Storage", is_storage=True)

def get_motherboard_from_spniq() -> List[Dict]:
    """Fetch Motherboards from spniq API"""
    return get_spniq_category_products("Motherboard", is_motherboard=True)

def get_monitor_from_spniq() -> List[Dict]:
    """Fetch Monitors from spniq API"""
    return get_spniq_category_products("Monitors", is_monitor=True)

def get_psu_from_spniq() -> List[Dict]:
    """Fetch Power Supplies from spniq API"""
    return get_spniq_category_products("PSU", is_power_supply=True)

def get_cooler_from_spniq() -> List[Dict]:
    """Fetch Coolers from spniq API"""
    return get_spniq_category_products("Coolers", is_cooler=True)

def get_case_from_spniq() -> List[Dict]:
    """Fetch Computer Cases from spniq API"""
    return get_spniq_category_products("Computer Cases", is_case=True)

def get_laptop_from_globaliraq() -> List[Dict]:
    """Fetch Laptops from Global Iraq API"""
    laptop_products = []
    
    try:
        url = "https://globaliraq.net/collections/laptop/products.json"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            print(f"Error fetching Global Iraq laptops: HTTP {res.status_code}")
            return []
        
        data = res.json()
        products = data.get("products", [])
        
        for item in products:
            try:
                product = parse_globaliraq_product(item, is_laptop=True)
                if product:
                    laptop_products.append(product)
            except Exception as e:
                print(f"Error parsing Global Iraq laptop product: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching Global Iraq laptops: {e}")
        return []
    
    return laptop_products

def get_laptop_from_kolshzin() -> List[Dict]:
    """Fetch Laptops from Kolshzin"""
    laptop_products = []
    
    try:
        # Get first page
        url = "https://kolshzin.com/product-category/laptops/"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            print(f"Error fetching Kolshzin laptops: HTTP {res.status_code}")
            return []
        
        soup = BeautifulSoup(res.content, 'html.parser')
        
        # Extract products from current page
        products = extract_kolshzin_products_from_page(soup, is_laptop=True)
        laptop_products.extend(products)
        
        # Check for pagination
        pagination = soup.find('nav', class_='woocommerce-pagination')
        if pagination:
            page_links = pagination.find_all('a', class_='page-numbers')
            max_page = 1
            for link in page_links:
                try:
                    page_num = int(link.text.strip())
                    max_page = max(max_page, page_num)
                except ValueError:
                    continue
            
            # Fetch additional pages (limit to 5 pages)
            for page in range(2, min(max_page + 1, 6)):
                try:
                    page_url = f"https://kolshzin.com/product-category/laptops/page/{page}/"
                    page_res = requests.get(page_url, headers=HEADERS)
                    if page_res.status_code == 200:
                        page_soup = BeautifulSoup(page_res.content, 'html.parser')
                        page_products = extract_kolshzin_products_from_page(page_soup, is_laptop=True)
                        laptop_products.extend(page_products)
                except Exception as e:
                    print(f"Error fetching Kolshzin laptops page {page}: {e}")
                    continue
                
    except Exception as e:
        print(f"Error fetching Kolshzin laptops: {e}")
        return []
    
    return laptop_products

def get_laptop_from_3diraq() -> List[Dict]:
    """Fetch Laptops from 3D Iraq"""
    laptop_products, _ = get_laptop_from_3diraq_with_links()
    return laptop_products

def get_laptop_from_3diraq_with_links() -> tuple[List[Dict], set]:
    """Fetch Laptops from 3D Iraq with link tracking"""
    laptop_products = []
    laptop_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/laptop?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    laptop_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_laptop=True)
                laptop_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return laptop_products, laptop_links

def get_spniq_category_products(category_name: str, **category_flags) -> List[Dict]:
    """Generic function to fetch products from any spniq category"""
    products = []
    
    try:
        # Get all categories first
        url = f"{BASE_URL_SPNIQ}/categories"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            print(f"Error fetching spniq categories: HTTP {res.status_code}")
            return []
        
        categories = res.json()
        if not isinstance(categories, list):
            print("spniq API returned unexpected format")
            return []
        
        # Find the target category
        target_category = None
        for category in categories:
            if category.get("title") == category_name:
                target_category = category
                break
        
        if not target_category:
            print(f"No {category_name} category found in spniq API")
            return []
        
        # Process products
        category_products = target_category.get("products", [])
        
        for item in category_products:
            try:
                product = parse_spniq_product(item, **category_flags)
                if product:
                    products.append(product)
            except Exception as e:
                print(f"Error parsing spniq {category_name} product: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching spniq {category_name} products: {e}")
        return []
    
    return products

def get_products_from_spniq() -> List[Dict]:
    
    """Main function to get all products from spniq"""
    products = []
    
    print("ðŸ•¸ï¸ spniq: Starting...")
    
    # Get products from all categories
    gpu_products = get_gpu_from_spniq()
    products.extend(gpu_products)
    
    cpu_products = get_cpu_from_spniq()
    products.extend(cpu_products)
    
    storage_products = get_storage_from_spniq()
    products.extend(storage_products)
    
    motherboard_products = get_motherboard_from_spniq()
    products.extend(motherboard_products)
    
    monitor_products = get_monitor_from_spniq()
    products.extend(monitor_products)
    
    psu_products = get_psu_from_spniq()
    products.extend(psu_products)
    
    cooler_products = get_cooler_from_spniq()
    products.extend(cooler_products)
    
    case_products = get_case_from_spniq()
    products.extend(case_products)
    
    print(f"âœ… spniq: Completed - {len(products)} products")
    return products

# -------------------- Galaxy IQ Parser --------------------
def parse_galaxyiq_product(product_div, category: str) -> Dict:
    """Parse a Galaxy IQ product from HTML"""
    try:
        # Extract link and image
        link_el = product_div.find('a', href=lambda x: x and '/products/' in x)
        if not link_el:
            return None
        
        product_url = link_el.get('href', '')
        if not product_url.startswith('http'):
            product_url = f"{BASE_URL_GALAXYIQ}{product_url}"
        
        # Extract image and title
        img_el = link_el.find('img')
        if not img_el:
            return None
            
        title = img_el.get('alt', '').strip()
        image_url = img_el.get('src', '')
        
        # Extract price
        price_div = product_div.find('div', class_='product_price')
        if not price_div:
            return None
        
        price_span = price_div.find('span', class_='price')
        if not price_span:
            return None
        
        price_text = price_span.get_text(strip=True)
        
        # Check for old price (discount)
        old_price_text = None
        del_tag = price_div.find('del')
        if del_tag:
            old_price_text = del_tag.get_text(strip=True)
        
        # Parse prices
        # Parse prices - Galaxy IQ specific: strip currency symbols and commas, then convert to int
        def parse_galaxyiq_price(price_str):
            if not price_str:
                return 0
            # Remove currency symbols (ع.د) and whitespace, keep only digits and commas
            clean_price = re.sub(r'[^\d,]', '', price_str)
            # Remove commas (used as thousands separators)
            clean_price = clean_price.replace(',', '')
            try:
                return int(clean_price)
            except:
                return 0
        
        price = parse_galaxyiq_price(price_text)
        old_price = parse_galaxyiq_price(old_price_text) if old_price_text else None
        
        # For compatibility, create price_data dict
        price_data = {'numeric_value': price, 'raw_value': price_text, 'currency': 'IQD'}
        compare_price_data = {'numeric_value': old_price, 'raw_value': old_price_text, 'currency': 'IQD'} if old_price else None

        
        normalized_compare_price = None
        if compare_price_data and compare_price_data['numeric_value'] > price:
            normalized_compare_price = old_price
        
        discount = calculate_discount(normalized_compare_price or 0, price) if normalized_compare_price else 0
        
        # Check stock status
        in_stock = True  # Galaxy IQ doesn't show out of stock on listing pages
        
        # Generate unique ID
        product_id = f"galaxyiq-{hashlib.md5(f'{title}_galaxyiq'.encode()).hexdigest()[:16]}"
        
        return {
            "id": product_id,
            "title": title,
            "price": price,
            "old_price": normalized_compare_price,
            "raw_price": price_text,
            "raw_old_price": old_price_text if normalized_compare_price else None,
            "detected_currency": 'IQD',
            "discount": discount,
            "image": image_url,
            "link": product_url,
            "store": "Galaxy IQ",
            "in_stock": in_stock,
            "category": category
        }
    except Exception as e:
        print(f"âš ï¸ Error parsing Galaxy IQ product: {e}")
        return None


# -------------------- Galaxy IQ Scraper --------------------
def get_products_from_galaxyiq() -> List[Dict]:
    """Scrape products from Galaxy IQ"""
    products = []
    
    print("🌌 Galaxy IQ: Starting...")
    
    # Category mappings: URL slug -> Our category name
    categories = {
        'graphics-cards-gpu': 'GPU',
        'processors': 'CPU',
        'ram': 'RAM',
        'motherboards': 'Motherboards',
        'storage': 'Storage',
        'power-supply-psu': 'Power Supply',
        'coolers': 'Cooler',
        'computer-cases': 'Case',
        'gaming-monitors': 'Monitors',
        'laptop': 'Laptops',
        'mouse-1': 'Mouse',
        'keyboard': 'Keyboard',
        'headsets': 'Headsets'
    }
    
    # Use cloudscraper to bypass Cloudflare protection
    import cloudscraper
    session = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'desktop': True
        }
    )
    
    for category_slug, category_name in categories.items():
        page = 1
        consecutive_failures = 0
        max_consecutive_failures = 3
        
        while consecutive_failures < max_consecutive_failures:
            try:
                url = f"{BASE_URL_GALAXYIQ}/product-categories/{category_slug}?page={page}"
                print(f"  ðŸ“„ Fetching {category_name} page {page}...")
                
                response = session.get(url, timeout=30)
                
                if response.status_code != 200:
                    print(f"  âš ï¸ Status {response.status_code} for {category_name} page {page}")
                    consecutive_failures += 1
                    break
                
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Find all products
                product_divs = soup.find_all('div', class_='product')
                
                if not product_divs:
                    print(f"  âœ… {category_name}: No more products on page {page}")
                    break
                
                page_product_count = 0
                for product_div in product_divs:
                    product = parse_galaxyiq_product(product_div, category_name)
                    if product:
                        products.append(product)
                        page_product_count += 1
                
                print(f"  âœ… {category_name} page {page}: Found {page_product_count} products")
                
                if page_product_count == 0:
                    consecutive_failures += 1
                else:
                    consecutive_failures = 0
                
                page += 1
                time.sleep(0.5)  # Be polite
                
            except Exception as e:
                print(f"  âš ï¸ Error fetching {category_name} page {page}: {e}")
                consecutive_failures += 1
                time.sleep(1)
    
    print(f"ðŸŒŒ Galaxy IQ: Completed - {len(products)} products")
    return products


def get_laptop_products() -> List[Dict]:
    """Get all laptop products from all sources"""
    all_laptops = []
    
    print("ðŸ•¸ï¸ Laptops: Starting...")
    
    # Global Iraq laptops
    try:
        globaliraq_laptops = get_laptop_from_globaliraq()
        all_laptops.extend(globaliraq_laptops)
        print(f"âœ… Global Iraq: {len(globaliraq_laptops)} laptops")
    except Exception as e:
        print(f"âŒ Global Iraq laptops failed: {e}")
    
    # Kolshzin laptops
    try:
        kolshzin_laptops = get_laptop_from_kolshzin()
        all_laptops.extend(kolshzin_laptops)
        print(f"âœ… Kolshzin: {len(kolshzin_laptops)} laptops")
    except Exception as e:
        print(f"âŒ Kolshzin laptops failed: {e}")
    
    # 3D Iraq laptops  
    try:
        diraq_laptops = get_laptop_from_3diraq()
        all_laptops.extend(diraq_laptops)
        print(f"âœ… 3D Iraq: {len(diraq_laptops)} laptops")
    except Exception as e:
        print(f"âŒ 3D Iraq laptops failed: {e}")
    
    print(f"âœ… Laptops: Completed - {len(all_laptops)} products")
    return all_laptops

# -------------------- 3D-Iraq Parser --------------------

def parse_3diraq_product(title: str, new_price_text: str, old_price_text: str, img_src: str, link: str, in_stock: bool = True, is_gpu: bool = False, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_mouse: bool = False, is_keyboard: bool = False, is_power_supply: bool = False, is_case: bool = False, is_storage: bool = False, is_cooler: bool = False, is_monitor: bool = False, is_headset: bool = False, is_laptop: bool = False) -> Dict:
    def fix_3diraq_price(price_str):
        if not price_str:
            return price_str
        price_str = str(price_str).strip()
        price_str = price_str.replace('Ø¹.Ø¯', '').replace('Ø¯.Ø¹', '').strip()
        if '.' in price_str:
            parts = price_str.split('.')
            if len(parts) == 2 and len(parts[1]) == 3:
                return parts[0] + parts[1]
        return price_str
    
    fixed_price = fix_3diraq_price(new_price_text)
    fixed_compare = fix_3diraq_price(old_price_text) if old_price_text else None
    
    price_data = parse_price(fixed_price)
    compare_price_data = parse_price(fixed_compare) if fixed_compare else None
    
    normalized_compare_price = None
    if compare_price_data and compare_price_data['numeric_value'] > price_data['numeric_value']:
        normalized_compare_price = compare_price_data['numeric_value']
    
    discount = calculate_discount(normalized_compare_price or 0, price_data['numeric_value']) if normalized_compare_price else 0

    product_data = {
        "id": f"3diraq-{hashlib.md5(f'{title}_3diraq'.encode()).hexdigest()[:16]}",
        "title": title,
        "price": price_data['numeric_value'],
        "old_price": normalized_compare_price,
        "raw_price": price_data['raw_value'],
        "raw_old_price": compare_price_data['raw_value'] if normalized_compare_price else None,
        "detected_currency": 'IQD',
        "discount": discount,
        "store": "3D-Iraq",
        "link": link,
        "image": img_src,
        "in_stock": in_stock
    }
    
    if is_gpu:
        product_data["category"] = "GPU"
    if is_ram:
        product_data["category"] = "RAM"
    if is_cpu:
        product_data["category"] = "CPU"
    if is_motherboard:
        product_data["category"] = "Motherboards"
    if is_mouse:
        product_data["category"] = "Mouse"
    if is_keyboard:
        product_data["category"] = "Keyboard"
    if is_power_supply:
        product_data["category"] = "Power Supply"
    if is_case:
        product_data["category"] = "Case"
    if is_storage:
        product_data["category"] = "Storage"
    if is_cooler:
        product_data["category"] = "Cooler"
    if is_monitor:
        product_data["category"] = "Monitor"
    if is_headset:
        product_data["category"] = "Headset"
    if is_laptop:
        product_data["category"] = "Laptop"
    
    return product_data

# -------------------- Almanjam Parser --------------------
def parse_almanjam_product(prod_id: str, name_ar: str, name_en: str, price: int, stock: int, img_url: str, discount: bool = False, price_after_discount: int = None, product_link: str = None, is_gpu: bool = False, is_ram: bool = False, is_cpu: bool = False, is_motherboard: bool = False, is_keyboard: bool = False, is_headset: bool = False, is_case: bool = False, is_power_supply: bool = False, is_cooler: bool = False, is_storage: bool = False, is_mouse: bool = False, is_monitor: bool = False) -> Dict:
    """Parse almanjam product data from JSON in script tags"""
    
    # Use price_after_discount ONLY if discount is True AND price_after_discount exists
    if discount and price_after_discount and price_after_discount < price:
        final_price = price_after_discount
        old_price = price
    else:
        final_price = price
        old_price = None
    
    # Calculate discount percentage
    discount_percent = calculate_discount(old_price or 0, final_price) if old_price else 0
    
    product_data = {
        "id": f"almanjam-{prod_id}",
        "title": name_en,  # Use English name as primary title
        "price": final_price,
        "old_price": old_price,
        "raw_price": f"{final_price}",
        "raw_old_price": f"{old_price}" if old_price else None,
        "detected_currency": "IQD",
        "discount": discount_percent,
        "store": "Almanjam",
        "link": product_link or f"{BASE_URL_ALMANJAM}/ar/product/{prod_id}",
        "image": img_url,
        "in_stock": True
    }
    
    # Add category based on flags
    if is_gpu:
        product_data["category"] = "GPU"
    elif is_ram:
        product_data["category"] = "RAM"
    elif is_cpu:
        product_data["category"] = "CPU"
    elif is_motherboard:
        product_data["category"] = "Motherboards"
    elif is_keyboard:
        product_data["category"] = "Keyboard"
    elif is_headset:
        product_data["category"] = "Headset"
    elif is_monitor:
        product_data["category"] = "Monitor"
    elif is_case:
        product_data["category"] = "Case"
    elif is_power_supply:
        product_data["category"] = "Power Supply"
    elif is_cooler:
        product_data["category"] = "Cooler"
    elif is_storage:
        product_data["category"] = "Storage"
    elif is_mouse:
        product_data["category"] = "Mouse"
    
    return product_data
# -------------------- Altajit Parser --------------------
def parse_altajit_product(product_data: dict, is_gpu: bool = False, is_laptop: bool = False, is_desktop: bool = False, is_monitor: bool = False, is_gaming_laptop: bool = False, is_all_in_one: bool = False, is_ram: bool = False, is_cooler: bool = False, is_case: bool = False, is_motherboard: bool = False, is_power_supply: bool = False, is_storage: bool = False, is_cpu: bool = False, is_keyboard: bool = False, is_mouse: bool = False, is_headset: bool = False) -> Dict:
    """Parse altajit product data from Shopify JSON API"""
    
    # Get basic product info
    title = product_data.get('title', 'Unknown')
    product_id = str(product_data.get('id', ''))
    handle = product_data.get('handle', '')
    vendor = product_data.get('vendor', '')
    
    # Get variants (Shopify products have variants with pricing)
    variants = product_data.get('variants', [])
    if not variants:
            return None
    
    # Use first variant for pricing (most products have one variant)
    variant = variants[0]
    
    price = float(variant.get('price', 0))
    compare_price = variant.get('compare_at_price')
    available = variant.get('available', True)
    
    # Calculate discount
    old_price = None
    discount_percent = 0
    if compare_price and float(compare_price) > price:
        old_price = float(compare_price)
        discount_percent = calculate_discount(old_price, price)
    
    # Get image - try featured_image first, then images array
    image_url = ""
    featured_image = product_data.get('featured_image')
    
    if featured_image:
        image_url = featured_image if featured_image.startswith('http') else f"https:{featured_image}"
    else:
        # No featured_image, try first image from images array
        images = product_data.get('images', [])
        if images:
            first_image = images[0]
            if isinstance(first_image, dict):
                image_src = first_image.get('src', '')
                if image_src:
                    image_url = image_src
            elif isinstance(first_image, str):
                # Maybe it's just a string URL
                image_url = first_image
    
    # Build product data
    parsed_product = {
        "id": f"altajit-{product_id}",
        "title": title,
        "price": int(price),
        "old_price": int(old_price) if old_price else None,
        "raw_price": f"{int(price)}",
        "raw_old_price": f"{int(old_price)}" if old_price else None,
        "detected_currency": "IQD",
        "discount": discount_percent,
        "store": "Altajit",
        "link": f"{BASE_URL_ALTAJIT}/products/{handle}",
        "image": image_url,
        "in_stock": available
    }
    
    # Add category
    if is_gpu:
        parsed_product["category"] = "GPU"
    elif is_laptop or is_gaming_laptop:
        parsed_product["category"] = "Laptop"
    elif is_desktop:
        parsed_product["category"] = "Desktop"
    elif is_all_in_one:
        parsed_product["category"] = "All In One"
    elif is_monitor:
        parsed_product["category"] = "Monitor"
    elif is_ram:
        parsed_product["category"] = "RAM"
    elif is_cooler:
        parsed_product["category"] = "Cooler"
    elif is_case:
        parsed_product["category"] = "Case"
    elif is_motherboard:
        parsed_product["category"] = "Motherboards"
    elif is_power_supply:
        parsed_product["category"] = "Power Supply"
    elif is_storage:
        parsed_product["category"] = "Storage"
    elif is_cpu:
        parsed_product["category"] = "CPU"
    elif is_keyboard:
        parsed_product["category"] = "Keyboard"
    elif is_mouse:
        parsed_product["category"] = "Mouse"
    elif is_headset:
        parsed_product["category"] = "Headset"
    
    return parsed_product

# -------------------- 3D-Iraq Scraper --------------------
def get_gpus_from_3diraq() -> tuple[List[Dict], set]:
    gpus = []
    gpu_links = set()
    page = 1
    
    while True:
        url = f"{BASE_URL_3DIRAQ}/collections/graphics-cards?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    gpu_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_gpu=True)
                gpus.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return gpus, gpu_links

def get_ram_from_3diraq() -> tuple[List[Dict], set]:
    ram_products = []
    ram_links = set()
    page = 1
    
    while True:
        url = f"{BASE_URL_3DIRAQ}/pc-part/ram?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    ram_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_ram=True)
                ram_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return ram_products, ram_links

def get_cpus_from_3diraq() -> tuple[List[Dict], set]:
    cpu_products = []
    cpu_links = set()
    page = 1
    
    while True:
        url = f"{BASE_URL_3DIRAQ}/pc-part/cpu?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    cpu_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_cpu=True)
                cpu_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cpu_products, cpu_links

def get_motherboards_from_3diraq() -> tuple[List[Dict], set]:
    motherboard_products = []
    motherboard_links = set()
    page = 1
    
    while True:
        url = f"{BASE_URL_3DIRAQ}/pc-part/motherboards?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    motherboard_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_motherboard=True)
                motherboard_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return motherboard_products, motherboard_links

def get_mice_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Mice directly from 3D-Iraq's mouse collection"""
    mouse_products = []
    mouse_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-accessories/mouse?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    mouse_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_mouse=True)
                mouse_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return mouse_products, mouse_links

def get_keyboards_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Keyboards directly from 3D-Iraq's keyboard collection"""
    keyboard_products = []
    keyboard_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-accessories/keybord?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    keyboard_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_keyboard=True)
                keyboard_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return keyboard_products, keyboard_links

def get_power_supply_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Power Supply directly from 3D-Iraq's power supply collection"""
    power_supply_products = []
    power_supply_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-part/power-supply?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    power_supply_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_power_supply=True)
                power_supply_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return power_supply_products, power_supply_links

def get_cases_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Cases directly from 3D-Iraq's case collection"""
    case_products = []
    case_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-part/case?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    case_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_case=True)
                case_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return case_products, case_links

def get_storage_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Storage directly from 3D-Iraq's storage collection"""
    storage_products = []
    storage_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-part/storge?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    storage_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_storage=True)
                storage_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return storage_products, storage_links

def get_coolers_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Coolers directly from 3D-Iraq's cooler collection"""
    cooler_products = []
    cooler_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-part/coolers-62?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    cooler_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_cooler=True)
                cooler_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return cooler_products, cooler_links

def get_monitors_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Monitors directly from 3D-Iraq's monitor collection"""
    monitor_products = []
    monitor_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/monitor?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    monitor_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_monitor=True)
                monitor_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return monitor_products, monitor_links

def get_headsets_from_3diraq() -> tuple[List[Dict], set]:
    """Fetch Headsets directly from 3D-Iraq's headset collection"""
    headset_products = []
    headset_links = set()
    page = 1
    
    while True:
        url = f"https://3d-iraq.com/pc-accessories/headset?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                link = title_el["href"] if title_el else ""
                
                if link:
                    headset_links.add(link)
                
                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock, is_headset=True)
                headset_products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    return headset_products, headset_links

def get_products_from_3diraq() -> List[Dict]:
    products = []
    
    print("ðŸ–¥ï¸ 3D-Iraq: Starting...")
    
    gpu_products, gpu_links = get_gpus_from_3diraq()
    products.extend(gpu_products)
    
    ram_products, ram_links = get_ram_from_3diraq()
    products.extend(ram_products)
    
    cpu_products, cpu_links = get_cpus_from_3diraq()
    products.extend(cpu_products)
    
    motherboard_products, motherboard_links = get_motherboards_from_3diraq()
    products.extend(motherboard_products)
    
    mouse_products, mouse_links = get_mice_from_3diraq()
    products.extend(mouse_products)
    
    keyboard_products, keyboard_links = get_keyboards_from_3diraq()
    products.extend(keyboard_products)
    
    power_supply_products, power_supply_links = get_power_supply_from_3diraq()
    products.extend(power_supply_products)
    
    case_products, case_links = get_cases_from_3diraq()
    products.extend(case_products)
    
    storage_products, storage_links = get_storage_from_3diraq()
    products.extend(storage_products)
    
    cooler_products, cooler_links = get_coolers_from_3diraq()
    products.extend(cooler_products)
    
    monitor_products, monitor_links = get_monitors_from_3diraq()
    products.extend(monitor_products)
    
    headset_products, headset_links = get_headsets_from_3diraq()
    products.extend(headset_products)
    
    # Get laptops
    laptop_products, laptop_links = get_laptop_from_3diraq_with_links()
    products.extend(laptop_products)
    
    # Get other products from general collection
    # Track links from specific collections to avoid duplicates
    all_excluded_links = gpu_links | ram_links | cpu_links | motherboard_links | mouse_links | keyboard_links | power_supply_links | case_links | storage_links | cooler_links | monitor_links | headset_links | laptop_links
    
    page = 1
    while True:
        url = f"{BASE_URL_3DIRAQ}/products?page={page}"
        res = requests.get(url, headers=HEADERS)
        if res.status_code != 200:
            break
        
        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select(".card.product-card")
        if not items:
            break
        
        for p in items:
            try:
                # Note: 3d-iraq doesn't show stock status on listing pages, only on individual product pages
                # To avoid making extra requests for each product, we set all as in_stock=True
                in_stock = True
                
                title_el = p.select_one("h3.product-title a")
                link = title_el["href"] if title_el else ""
                
                # Skip if this product is already in our specialized collections
                if link in gpu_links or link in ram_links or link in cpu_links or link in motherboard_links or link in mouse_links or link in keyboard_links:
                    continue
                
                new_price_el = p.select_one(".product-price .text-primary")
                old_price_el = p.select_one(".product-price del")

                title = title_el.text.strip() if title_el else "Unknown"
                new_price_text = new_price_el.text if new_price_el and new_price_el.text else "0"
                old_price_text = old_price_el.text if old_price_el and old_price_el.text else None

                img_el = p.select_one("img")
                img_src = img_el.get("data-src") or img_el.get("src") if img_el else ""
                if img_src and not img_src.startswith("http"):
                    img_src = BASE_URL_3DIRAQ + img_src

                # Skip if this product link is already in our specialized collections
                if link and link in all_excluded_links:
                    continue

                product = parse_3diraq_product(title, new_price_text, old_price_text, img_src, link, in_stock)
                products.append(product)
                    
            except Exception as e:
                continue
        
        page += 1
        time.sleep(0.3)
    
    # Remove duplicates based on product ID
    seen_ids = set()
    unique_products = []
    
    for product in products:
        product_id = product.get('id')
        if product_id not in seen_ids:
            seen_ids.add(product_id)
            unique_products.append(product)
    
    return unique_products

# -------------------- Almanjam Scraper --------------------
def scrape_almanjam_category(category_type: str, **category_flags) -> List[Dict]:
    """Generic function to scrape almanjam category"""
    products = []
    page = 1
    max_pages = 20
    
    while page <= max_pages:
        url = f"{BASE_URL_ALMANJAM}/ar/search?tag0=type:{category_type}&&from=&page={page}"
        
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code != 200:
                break
            
            soup = BeautifulSoup(res.content, 'html.parser')
            scripts = soup.find_all('script')
            
            products_found = False
            new_products_count = 0
            
            for script in scripts:
                script_text = script.string
                if script_text and 'nameAr' in script_text and 'price' in script_text and len(script_text) > 1000:
                    # Extract products using regex pattern (handle both escaped and unescaped JSON)
                    # Try escaped version first (most common)
                    product_pattern = r'\\"id\\":\\"([^"\\]+)\\"[^}]*?\\"nameAr\\":\\"([^"\\]+)\\"[^}]*?\\"nameEn\\":\\"([^"\\]+)\\"[^}]*?\\"price\\":(\d+)[^}]*?\\"stock\\":(\d+)'
                    matches_escaped = list(re.finditer(product_pattern, script_text))
                    
                    # Try unescaped version for products with quotes in names
                    product_pattern_unescaped = r'"id":"([^"]+)"[^}]*?"nameAr":"([^"]*)"[^}]*?"nameEn":"([^"]*)"[^}]*?"price":(\d+)[^}]*?"stock":(\d+)'
                    matches_unescaped = list(re.finditer(product_pattern_unescaped, script_text))
                    
                    # Try flexible pattern for products that might be missing stock field
                    flexible_pattern = r'\\"id\\":\\"([^"\\]+)\\"[^}]*?\\"nameAr\\":\\"([^"\\]+)\\"[^}]*?\\"nameEn\\":\\"([^"\\]+)\\"[^}]*?\\"price\\":(\d+)'
                    matches_flexible = []
                    for match in re.finditer(flexible_pattern, script_text):
                        prod_id, name_ar, name_en, price = match.groups()
                        # Try to find stock in nearby context
                        context = script_text[match.start():match.start()+500]
                        stock_match = re.search(r'\\"stock\\":(\d+)', context)
                        stock = stock_match.group(1) if stock_match else "0"
                        # Create a fake match object with 5 groups
                        class FakeMatch:
                            def groups(self):
                                return (prod_id, name_ar, name_en, price, stock)
                            def start(self):
                                return match.start()
                        fake_match = FakeMatch()
                        matches_flexible.append(fake_match)
                    
                    # Try simpler pattern for ALL products with IDs (regardless of structure)
                    simple_pattern = r'\\"id\\":\\"([a-f0-9\-]+)\\"'
                    all_product_ids = set(re.findall(simple_pattern, script_text))
                    
                    # For each ID, try to extract basic info from nearby context
                    matches_simple = []
                    for prod_id in all_product_ids:
                        # Skip if already found by other patterns
                        if prod_id in [m.groups()[0] for m in matches_escaped + matches_unescaped + matches_flexible]:
                            continue
                            
                        # Find context around this ID
                        id_search = f'\\"id\\":\\"{re.escape(prod_id)}\\"'
                        id_match = re.search(id_search, script_text)
                        if id_match:
                            start = id_match.start()
                            context = script_text[max(0, start-200):start+800]
                            
                            # Extract name and price from context (flexible patterns)
                            name_en = "Unknown Monitor"
                            price = "0"
                            
                            # Try various name patterns (escaped format)
                            name_patterns = [
                                r'\\"nameEn\\":\\"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)\\"',
                                r'\\"nameEn\\":\\"([^"\\\\]*)\\"',
                                r'\\"titleEn\\":\\"([^"\\\\]*)\\"'
                            ]
                            for pattern in name_patterns:
                                name_match = re.search(pattern, context)
                                if name_match:
                                    name_en = name_match.group(1)
                                    break
                            
                            # Try to find price (escaped format)
                            price_match = re.search(r'\\"price\\":(\d+)', context)
                            if price_match:
                                price = price_match.group(1)
                            
                            # Create match if we have decent info
                            if name_en != "Unknown Monitor" or price != "0":
                                class SimpleMatch:
                                    def groups(self):
                                        return (prod_id, name_en, name_en, price, "1")  # nameAr=nameEn for simplicity
                                    def start(self):
                                        return start
                                matches_simple.append(SimpleMatch())
                    
                    # Combine all sets of matches
                    all_matches = matches_escaped + matches_unescaped + matches_flexible + matches_simple
                    
                    # Remove duplicates from different patterns (same ID)
                    seen_ids = set()
                    unique_matches = []
                    for match in all_matches:
                        prod_id = match.groups()[0]
                        if prod_id not in seen_ids:
                            seen_ids.add(prod_id)
                            unique_matches.append(match)
                    
                    if unique_matches:
                        products_found = True
                        
                        for match in unique_matches:
                            prod_id, name_ar, name_en, price, stock = match.groups()
                            new_products_count += 1
                            
                            # Extract image URL, discount info, and variant info
                            img_url = ""
                            variant_info = ""
                            # Use the match position to get the exact context for this specific occurrence
                            idx = match.start()
                            if idx != -1:
                                # Limit context to just this product (find next "id" field to know where this product ends)
                                next_product_idx = script_text.find('\\"id\\":\\"', idx + 10)
                                if next_product_idx != -1:
                                    context = script_text[idx:next_product_idx]
                                else:
                                    context = script_text[idx:idx+1000]  # Fallback to 1000 chars
                                
                                img_match = re.search(r'\\"image\\":\[\\"([^"\\]+)\\"', context)
                                if img_match:
                                    img_url = img_match.group(1)
                                
                                # Extract variant/capacity info from nameEnProp only
                                variant_match = re.search(r'\\"nameEnProp\\":\\"([^"\\]+)\\"', context)
                                if variant_match:
                                    variant_info = variant_match.group(1).strip()
                                
                                # Extract discount info (NOW only from THIS product's data)
                                discount = False
                                price_after_discount = None
                                discount_match = re.search(r'\\"discount\\":true', context)
                                if discount_match:
                                    discount = True
                                    price_after_match = re.search(r'\\"priceAfterDiscount\\":(\d+)', context)
                                    if price_after_match:
                                        price_after_discount = int(price_after_match.group(1))
                            
                            # Enhance title with variant info if available
                            enhanced_name_en = name_en
                            if variant_info and variant_info not in name_en:
                                enhanced_name_en = f"{name_en} {variant_info}"
                            
                            # Create base link
                            base_link = f"{BASE_URL_ALMANJAM}/ar/product/{prod_id}"
                            # Add variant parameter only if variant_info exists (mainly for storage)
                            product_link = f"{base_link}?primary={variant_info}" if variant_info else base_link
                            
                            # Create unique ID by including variant info and price to ensure uniqueness
                            if variant_info:
                                safe_variant = variant_info.replace(' ', '-').replace('.', '')
                                unique_id = f"{prod_id}-{safe_variant}-{price}"
                            else:
                                unique_id = prod_id
                            
                            product = parse_almanjam_product(
                                unique_id, name_ar, enhanced_name_en, int(price), int(stock), 
                                img_url, discount, price_after_discount, product_link, **category_flags
                            )
                            products.append(product)
                        
                        break
            
            if not products_found or (new_products_count == 0 and page >= 2):
                break
            
            page += 1
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Error scraping almanjam {category_type}: {e}")
            break
    
    return products

def get_products_from_almanjam() -> List[Dict]:
    """Scrape all categories from almanjam"""
    all_products = []
    
    print("ðŸ›’ Almanjam: Starting...")
    
    # GPU
    gpu_products = scrape_almanjam_category("gpu", is_gpu=True)
    all_products.extend(gpu_products)
    print(f"  GPUs: {len(gpu_products)}")
    
    # Motherboards
    mb_products = scrape_almanjam_category("mb", is_motherboard=True)
    all_products.extend(mb_products)
    print(f"  Motherboards: {len(mb_products)}")
    
    # CPU
    cpu_products = scrape_almanjam_category("cpu", is_cpu=True)
    all_products.extend(cpu_products)
    print(f"  CPUs: {len(cpu_products)}")
    
    # RAM
    ram_products = scrape_almanjam_category("ram", is_ram=True)
    all_products.extend(ram_products)
    print(f"  RAM: {len(ram_products)}")
    
    # Keyboards
    keyboard_products = scrape_almanjam_category("keyboard", is_keyboard=True)
    all_products.extend(keyboard_products)
    print(f"  Keyboards: {len(keyboard_products)}")
    
    # Headsets
    headset_products = scrape_almanjam_category("headset", is_headset=True)
    all_products.extend(headset_products)
    print(f"  Headsets: {len(headset_products)}")
    
    # Cases
    case_products = scrape_almanjam_category("case", is_case=True)
    all_products.extend(case_products)
    print(f"  Cases: {len(case_products)}")
    
    # Power Supplies (PSU)
    psu_products = scrape_almanjam_category("psu", is_power_supply=True)
    all_products.extend(psu_products)
    print(f"  Power Supplies: {len(psu_products)}")
    
    # Coolers
    cooler_products = scrape_almanjam_category("cooler", is_cooler=True)
    all_products.extend(cooler_products)
    print(f"  Coolers: {len(cooler_products)}")
    
    # Storage
    storage_products = scrape_almanjam_category("storage", is_storage=True)
    all_products.extend(storage_products)
    print(f"  Storage: {len(storage_products)}")
    
    # Mouse
    mouse_products = scrape_almanjam_category("mouse", is_mouse=True)
    all_products.extend(mouse_products)
    print(f"  Mice: {len(mouse_products)}")
    
    print(f"Almanjam scraped: {len(all_products)} products")
    return all_products

# -------------------- Altajit Scraper (Shopify JSON API) --------------------
def scrape_altajit_collection(collection_handle: str, **category_flags) -> List[Dict]:
    """Scrape a collection from altajit using Shopify JSON API"""
    products = []
    
    url = f"{BASE_URL_ALTAJIT}/collections/{collection_handle}/products.json"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"Failed to fetch {collection_handle}: HTTP {response.status_code}")
            return products
        
        data = response.json()
        product_list = data.get('products', [])
        
        for product_data in product_list:
            parsed_product = parse_altajit_product(product_data, **category_flags)
            if parsed_product:
                products.append(parsed_product)
        
        return products
        
    except Exception as e:
        print(f"Error scraping altajit collection {collection_handle}: {e}")
        return products

def get_products_from_altajit() -> List[Dict]:
    """Scrape all categories from altajit"""
    all_products = []
    
    
    # GPU/Graphics Cards
    gpu_products = scrape_altajit_collection("video-graphic-cards", is_gpu=True)
    all_products.extend(gpu_products)
    
    # Laptops (regular)
    laptop_products = scrape_altajit_collection("laptops", is_laptop=True)
    all_products.extend(laptop_products)
    
    # Gaming Laptops
    gaming_laptop_products = scrape_altajit_collection("gaming-laptop", is_gaming_laptop=True)
    all_products.extend(gaming_laptop_products)
    
    # Monitors (regular + gaming)
    monitor_products = scrape_altajit_collection("monitor", is_monitor=True)
    all_products.extend(monitor_products)
    
    gaming_monitor_products = scrape_altajit_collection("gaming-monitor", is_monitor=True)
    all_products.extend(gaming_monitor_products)
    
    # RAM/Memory
    ram_products = scrape_altajit_collection("memory-ram", is_ram=True)
    all_products.extend(ram_products)
    
    # Fans/Cooling
    cooler_products = scrape_altajit_collection("fans-cooling", is_cooler=True)
    all_products.extend(cooler_products)
    
    # Computer Cases
    case_products = scrape_altajit_collection("computer-cases", is_case=True)
    all_products.extend(case_products)
    
    # Motherboards
    motherboard_products = scrape_altajit_collection("motherboards", is_motherboard=True)
    all_products.extend(motherboard_products)
    
    # Power Supplies
    psu_products = scrape_altajit_collection("power-supplies", is_power_supply=True)
    all_products.extend(psu_products)
    
    # Storage (internal + external)
    internal_storage_products = scrape_altajit_collection("internal-hard-drives", is_storage=True)
    all_products.extend(internal_storage_products)
    
    external_storage_products = scrape_altajit_collection("external-hddssd", is_storage=True)
    all_products.extend(external_storage_products)
    
    # CPUs
    cpu_products = scrape_altajit_collection("cpus-processors", is_cpu=True)
    all_products.extend(cpu_products)
    
    # Keyboards
    keyboard_products = scrape_altajit_collection("keyboards", is_keyboard=True)
    all_products.extend(keyboard_products)
    
    # Mice
    mouse_products = scrape_altajit_collection("mouse", is_mouse=True)
    all_products.extend(mouse_products)
    
    # Headphones/Headsets
    headset_products = scrape_altajit_collection("headphones", is_headset=True)
    all_products.extend(headset_products)
    
    print(f"Altajit scraped: {len(all_products)} products")
    
    # Remove duplicates based on product ID
    seen_ids = set()
    unique_products = []
    
    for product in all_products:
        product_id = product.get('id')
        if product_id not in seen_ids:
            seen_ids.add(product_id)
            unique_products.append(product)
    
    return unique_products

# -------------------- Main Functions --------------------
def scrape_site_individually(site_name: str) -> List[Dict]:
    """Scrape a single site and return its products"""
    if site_name.lower() == "globaliraq":
        return get_products_from_globaliraq()
    elif site_name.lower() == "alityan":
        return get_products_from_alityan()
    elif site_name.lower() == "kolshzin":
        return get_products_from_kolshzin()
    elif site_name.lower() == "3d-iraq":
        return get_products_from_3diraq()
    elif site_name.lower() == "jokercenter":
        return get_products_from_jokercenter()
    elif site_name.lower() == "almanjam":
        return get_products_from_almanjam()
    elif site_name.lower() == "altajit":
        return get_products_from_altajit()
    elif site_name.lower() == "spniq":
        return get_products_from_spniq()
    else:
        return []

def scrape_all_products() -> List[Dict]:
    """Scrape all sites and return combined products"""
    all_products = []
    
    try:
        globaliraq_products = get_products_from_globaliraq()
        all_products.extend(globaliraq_products)
        
        alityan_products = get_products_from_alityan()
        all_products.extend(alityan_products)
        
        kolshzin_products = get_products_from_kolshzin()
        all_products.extend(kolshzin_products)
        
        diraq_products = get_products_from_3diraq()
        all_products.extend(diraq_products)

        # Scrape JokerCenter
        jokercenter_products = []
        try:
            print("📄 Attempting to start JokerCenter...")
            jokercenter_products = get_products_from_jokercenter()
            all_products.extend(jokercenter_products)
            print(f"JokerCenter Completed - {len(jokercenter_products)} products")
        except Exception as e:
            print(f"❌ JokerCenter FAILED: {e}")
            import traceback
            print(traceback.format_exc())
            # Still extend with empty array so safety check can work
            all_products.extend(jokercenter_products)
        
        # Scrape Almanjam
        try:
            print("ðŸ”„ Attempting to start Almanjam...")
            almanjam_products = get_products_from_almanjam()
            all_products.extend(almanjam_products)
            print(f"Almanjam Completed - {len(almanjam_products)} products")
        except Exception as e:
            print(f"âŒ Almanjam FAILED: {e}")
            import traceback
            print(traceback.format_exc())
        
        # Scrape Altajit
        try:
            print("ðŸ”„ Attempting to start Altajit...")
            altajit_products = get_products_from_altajit()
            all_products.extend(altajit_products)
            print(f"Altajit Completed - {len(altajit_products)} products")
        except Exception as e:
            print(f"âŒ Altajit FAILED: {e}")
            import traceback
            print(traceback.format_exc())
        
    except Exception as e:
        print(f"Error in scrape_all_products: {e}")
    
    return all_products
