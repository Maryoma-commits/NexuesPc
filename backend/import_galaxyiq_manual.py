"""
Galaxy IQ Manual Import Script
Run this after manually scraping Galaxy IQ products from browser

HOW TO USE:
1. Paste your scraped JSON data into backend/galaxyiq_scraped_data.json
2. Run: python backend/import_galaxyiq_manual.py
3. Done!
"""

import json
from pathlib import Path
from main import load_frontend_data, preserve_compatibility_specs
from datetime import datetime

def import_galaxyiq_manual():
    """Import manually scraped Galaxy IQ products"""
    
    print("🌌 Galaxy IQ Manual Import Starting...")
    
    # Load scraped data from JSON file
    scraped_file = Path(__file__).parent / "galaxyiq_scraped_data.json"
    
    if not scraped_file.exists():
        print(f"❌ File not found: {scraped_file}")
        print("Please create galaxyiq_scraped_data.json and paste your scraped data there")
        return
    
    with open(scraped_file, 'r', encoding='utf-8') as f:
        manual_products = json.load(f)
    
    if not manual_products:
        print("❌ No products to import! Please paste your JSON data in galaxyiq_scraped_data.json")
        return
    
    print(f"📦 Found {len(manual_products)} products to import")
    
    # Load existing data
    print("📂 Loading existing products.json...")
    existing_data = load_frontend_data()
    
    # Get existing Galaxy IQ products to preserve specs
    existing_galaxyiq = []
    if "galaxyiq" in existing_data.get("sites", {}):
        existing_galaxyiq = existing_data["sites"]["galaxyiq"].get("products", [])
        print(f"🔄 Found {len(existing_galaxyiq)} existing Galaxy IQ products")
    
    # Preserve compatibility specs
    if existing_galaxyiq:
        manual_products = preserve_compatibility_specs(manual_products, existing_galaxyiq)
        print("✅ Preserved existing specs and categories")
    
    # Update Galaxy IQ data
    if "sites" not in existing_data:
        existing_data["sites"] = {}
    
    existing_data["sites"]["galaxyiq"] = {
        "last_updated": datetime.now().isoformat(),
        "product_count": len(manual_products),
        "products": manual_products
    }
    
    # Save to products.json
    products_path = Path(__file__).parent.parent / "public" / "data" / "products.json"
    with open(products_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Successfully imported {len(manual_products)} Galaxy IQ products!")
    print(f"📁 Saved to: {products_path}")
    print("\n🎉 Galaxy IQ data updated in products.json!")

if __name__ == "__main__":
    import_galaxyiq_manual()
