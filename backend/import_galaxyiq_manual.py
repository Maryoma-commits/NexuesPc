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
    
    print(f"📦 Found {len(manual_products)} products in manual.json")
    
    # Load existing data
    print("📂 Loading existing products.json...")
    existing_data = load_frontend_data()
    
    # Get existing Galaxy IQ products
    existing_galaxyiq = []
    if "galaxyiq" in existing_data.get("sites", {}):
        existing_galaxyiq = existing_data["sites"]["galaxyiq"].get("products", [])
        print(f"🔄 Found {len(existing_galaxyiq)} existing Galaxy IQ products")
    
    # Smart merge logic
    print("\n🧠 Starting smart merge...")
    
    # Create ID mapping for existing products
    existing_by_id = {prod['id']: prod for prod in existing_galaxyiq}
    manual_by_id = {prod['id']: prod for prod in manual_products}
    
    merged_products = []
    updated_count = 0
    added_count = 0
    preserved_count = 0
    
    # Process manual products (update or add)
    for manual_prod in manual_products:
        prod_id = manual_prod['id']
        
        if prod_id in existing_by_id:
            # Product exists - merge with preservation
            existing_prod = existing_by_id[prod_id]
            
            # Preserve user-edited fields (specs, category if manually changed, etc.)
            merged_prod = manual_prod.copy()
            
            # Keep compatibility specs if they exist
            if 'compatibility' in existing_prod:
                merged_prod['compatibility'] = existing_prod['compatibility']
            
            # Keep userEditedFields if they exist
            if 'userEditedFields' in existing_prod:
                merged_prod['userEditedFields'] = existing_prod['userEditedFields']
                # If category was manually edited, keep it
                if 'category' in existing_prod.get('userEditedFields', {}):
                    merged_prod['category'] = existing_prod['category']
            
            merged_products.append(merged_prod)
            updated_count += 1
            print(f"  ✏️  Updated: {merged_prod['title'][:50]}...")
        else:
            # New product - add it
            merged_products.append(manual_prod)
            added_count += 1
            print(f"  ➕ Added: {manual_prod['title'][:50]}...")
    
    # Keep existing products that are NOT in manual.json
    for existing_prod in existing_galaxyiq:
        prod_id = existing_prod['id']
        if prod_id not in manual_by_id:
            merged_products.append(existing_prod)
            preserved_count += 1
    
    print(f"\n📊 Merge Summary:")
    print(f"  ✏️  Updated: {updated_count} products")
    print(f"  ➕ Added: {added_count} new products")
    print(f"  💾 Preserved: {preserved_count} existing products")
    print(f"  📦 Total: {len(merged_products)} products")
    
    # Update Galaxy IQ data
    if "sites" not in existing_data:
        existing_data["sites"] = {}
    
    existing_data["sites"]["galaxyiq"] = {
        "last_updated": datetime.now().isoformat(),
        "product_count": len(merged_products),
        "products": merged_products
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
