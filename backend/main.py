import threading
import concurrent.futures
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Dict, Any
from scraper import scrape_all_products, scrape_site_individually
import time
import json
import os
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Frontend public JSON file path
FRONTEND_JSON_FILE = "../public/data/products.json"

# Ensure frontend data directory exists
os.makedirs("../public/data", exist_ok=True)


@app.post("/scrape")
def manual_scrape():
    """Manually trigger scraping all sites and update frontend JSON file"""
    try:
        print("🌐 Manual scrape requested...")
        scrape_and_save_all_sites()
        return {"status": "success", "message": "All sites scraped and frontend JSON updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/scrape/{site_name}")
def scrape_single_site_endpoint(site_name: str):
    """Scrape a single site and merge with existing data"""
    try:
        valid_sites = ["globaliraq", "alityan", "kolshzin", "3d-iraq", "jokercenter", "galaxyiq", "almanjam", "spniq", "altajit"]
        
        if site_name.lower() not in valid_sites:
            return {"status": "error", "message": f"Invalid site name. Valid sites: {', '.join(valid_sites)}"}
        
        print(f"🌐 Manual scrape requested for {site_name}...")
        scrape_and_save_single_site(site_name.lower())
        return {"status": "success", "message": f"{site_name} scraped and merged successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/admin", response_class=HTMLResponse)
def admin_dashboard():
    """Serve the admin dashboard HTML"""
    try:
        with open("../admin_dashboard.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Admin Dashboard Not Found</h1><p>Please ensure admin_dashboard.html exists in the project root.</p>", status_code=404)

@app.get("/WebSitesLogo/{filename}")
def serve_logo(filename: str):
    """Serve website logo files"""
    import os
    logo_path = f"../WebSitesLogo/{filename}"
    if os.path.exists(logo_path):
        return FileResponse(logo_path)
    else:
        return {"error": "Logo not found"}

@app.get("/products")
def get_all_products():
    """Get all products data for admin dashboard"""
    import json
    import os
    
    try:
        products_path = "../public/data/products.json"
        if os.path.exists(products_path):
            with open(products_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        else:
            return {"sites": {}, "total_products": 0, "last_updated": "Never"}
    except Exception as e:
        return {"error": str(e), "sites": {}, "total_products": 0}

@app.get("/")
def root():
    """Redirect root to admin dashboard"""
    return HTMLResponse(content='<script>window.location.href="/admin";</script>')

@app.get("/status")
def get_status():
    """Get status of frontend JSON file"""
    try:
        frontend_data = load_frontend_data()
        file_exists = os.path.exists(FRONTEND_JSON_FILE)
        
        if file_exists:
            file_size_kb = round(os.path.getsize(FRONTEND_JSON_FILE) / 1024, 2)
        else:
            file_size_kb = 0
            
        return {
            "file_exists": file_exists,
            "last_updated": frontend_data.get('last_updated', 'Never'),
            "total_products": frontend_data.get('total_products', 0),
            "file_size_kb": file_size_kb,
            "sites": {
                site_name: {
                    "product_count": site_data.get("product_count", 0),
                    "last_updated": site_data.get("last_updated", "Never")
                }
                for site_name, site_data in frontend_data.get("sites", {}).items()
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/save-products")
def save_products_endpoint(products_data: Dict[str, Any]):
    """Save updated products data to main JSON file with backup protection"""
    try:
        # Create backup before saving
        backup_file = f"public/data/products_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        import shutil
        shutil.copy2(FRONTEND_JSON_FILE, backup_file)
        print(f"📋 Created backup: {backup_file}")
        
        # Validate data before saving
        if not products_data.get('sites'):
            raise ValueError("Invalid products data - missing sites")
        
        # Save with proper formatting
        with open(FRONTEND_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(products_data, f, indent=2, ensure_ascii=False)
        
        total_products = products_data.get('total_products', 0)
        print(f"✅ Saved {total_products} products to main database via API")
        
        return {"status": "success", "message": f"Saved {total_products} products successfully"}
    except Exception as e:
        print(f"❌ Failed to save products via API: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/save-single-spec")
def save_single_spec_endpoint(spec_data: Dict[str, Any]):
    """Save compatibility specs for a single product"""
    try:
        product_id = spec_data.get('product_id')
        site_name = spec_data.get('site_name')
        compatibility_specs = spec_data.get('compatibility_specs')
        
        # Category change fields
        category = spec_data.get('category')
        manual_category = spec_data.get('manual_category')
        original_category = spec_data.get('original_category')
        
        if not all([product_id, site_name]):
            raise ValueError("Missing required fields: product_id, site_name")
        
        # Load current data
        current_data = load_frontend_data()
        
        # Find and update the specific product
        if site_name in current_data.get('sites', {}):
            products = current_data['sites'][site_name].get('products', [])
            print(f"🔍 Looking for product {product_id} in {site_name} (has {len(products)} products)")
            
            product_found = False
            for product in products:
                if product.get('id') == product_id:
                    product_found = True
                    print(f"🎯 Found product: {product.get('title', 'Unknown')}")
                    
                    if compatibility_specs is None:
                        # Remove compatibility_specs field entirely
                        if 'compatibility_specs' in product:
                            del product['compatibility_specs']
                            print(f"🗑️ Removed compatibility_specs from product")
                        else:
                            print(f"⚠️ Product already has no compatibility_specs")
                    else:
                        # Add/update compatibility specs
                        print(f"📝 Adding specs: {compatibility_specs}")
                        product['compatibility_specs'] = compatibility_specs
                        
                        # Verify the specs were added
                        if 'compatibility_specs' in product:
                            print(f"✅ Specs confirmed in product object: {product['compatibility_specs']}")
                        else:
                            print(f"❌ Specs NOT found in product object!")
                    
                    # Handle category changes
                    if category:
                        print(f"🔄 Updating category from '{product.get('category')}' to '{category}'")
                        product['category'] = category
                        
                        if manual_category:
                            product['manual_category'] = manual_category
                            print(f"📝 Set manual_category: {manual_category}")
                            
                        if original_category:
                            product['original_category'] = original_category
                            print(f"📝 Set original_category: {original_category}")
                    
                    # Save updated data
                    print(f"💾 Saving to file: {FRONTEND_JSON_FILE}")
                    with open(FRONTEND_JSON_FILE, 'w', encoding='utf-8') as f:
                        json.dump(current_data, f, indent=2, ensure_ascii=False)
                    
                    print(f"✅ File saved successfully")
                    action = "Removed" if compatibility_specs is None else "Updated"
                    return {"status": "success", "message": f"{action} specs for product {product_id}"}
            
            if not product_found:
                print(f"❌ Product {product_id} not found in {site_name}")
                print(f"📋 Available product IDs: {[p.get('id', 'NO_ID')[:20] for p in products[:5]]}...")
                raise ValueError(f"Product {product_id} not found in {site_name}")
        else:
            print(f"❌ Site {site_name} not found")
            print(f"📋 Available sites: {list(current_data.get('sites', {}).keys())}")
            raise ValueError(f"Site {site_name} not found")
            
    except Exception as e:
        print(f"❌ Failed to save single spec: {e}")
        return {"status": "error", "message": str(e)}

def save_all_products_to_frontend(all_sites_data: Dict[str, List[Dict[str, Any]]], merge: bool = False) -> None:
    """Save all products data to frontend JSON file with optional merge and compatibility specs preservation"""
    
    if merge:
        # Load existing data and merge
        existing_data = load_frontend_data()
        
        # Manual-only retailers that should be preserved (not auto-scraped)
        manual_retailers = ["galaxyiq"]  # Add any other manual retailers here
        
        # Preserve manual retailers by adding them to the scrape data
        for manual_retailer in manual_retailers:
            if manual_retailer not in all_sites_data and manual_retailer in existing_data.get("sites", {}):
                print(f"💾 Preserving manual retailer: {manual_retailer}")
                # Add existing manual retailer data to all_sites_data so it gets saved
                all_sites_data[manual_retailer] = existing_data["sites"][manual_retailer].get("products", [])
        
        # Update only the sites that were scraped
        for site_name, products in all_sites_data.items():
            # SAFETY CHECK: Don't overwrite existing products if scraper returned 0
            if len(products) == 0:
                if site_name in existing_data.get("sites", {}):
                    existing_count = existing_data["sites"][site_name].get("product_count", 0)
                    if existing_count > 0:
                        print(f"⚠️  WARNING: {site_name} scraper returned 0 products but {existing_count} exist. Keeping existing products.")
                        continue  # Skip this retailer - don't update
                    else:
                        print(f"ℹ️  {site_name} returned 0 products (no existing products to preserve)")
                else:
                    print(f"ℹ️  {site_name} returned 0 products (new retailer)")
            
            # Preserve compatibility specs from existing products
            if site_name in existing_data.get("sites", {}):
                existing_products = existing_data["sites"][site_name].get("products", [])
                products = preserve_compatibility_specs(products, existing_products)
            
            existing_data["sites"][site_name] = {
                "last_updated": datetime.now().isoformat(),
                "product_count": len(products),
                "products": products
            }
        
        # Recalculate total products
        total_products = sum(
            site_data.get("product_count", 0) 
            for site_data in existing_data["sites"].values()
        )
        existing_data["total_products"] = total_products
        existing_data["last_updated"] = datetime.now().isoformat()
        
        data = existing_data
    else:
        # Load existing data to preserve compatibility specs even in replace mode
        existing_data = load_frontend_data()
        
        total_products = sum(len(products) for products in all_sites_data.values())
        
        data = {
            "last_updated": datetime.now().isoformat(),
            "total_products": total_products,
            "sites": {}
        }
        
        for site_name, products in all_sites_data.items():
            # Preserve compatibility specs from existing products
            if site_name in existing_data.get("sites", {}):
                existing_products = existing_data["sites"][site_name].get("products", [])
                products = preserve_compatibility_specs(products, existing_products)
            
            data["sites"][site_name] = {
                "last_updated": datetime.now().isoformat(),
                "product_count": len(products),
                "products": products
            }
    
    try:
        with open(FRONTEND_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        total_products = data["total_products"]
        print(f"✅ {'Merged' if merge else 'Saved'} {total_products} total products to frontend file")
        
        # Print breakdown per site
        for site_name in all_sites_data.keys():
            count = data["sites"][site_name]["product_count"]
            print(f"  └─ {site_name}: {count} products")
            
    except Exception as e:
        print(f"❌ Failed to save frontend data: {e}")

def preserve_compatibility_specs(new_products: List[Dict[str, Any]], existing_products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Preserve compatibility_specs from existing products when updating with scraped data"""
    
    # Create a lookup map of existing products by ID
    existing_specs_map = {}
    
    for existing_product in existing_products:
        product_id = existing_product.get('id')
        compatibility_specs = existing_product.get('compatibility_specs')
        manual_category = existing_product.get('manual_category')
        original_category = existing_product.get('original_category')
        
        if product_id and (compatibility_specs or manual_category or original_category):
            existing_specs_map[product_id] = {
                'compatibility_specs': compatibility_specs,
                'manual_category': manual_category,
                'original_category': original_category
            }
    
    # Apply existing specs to new products
    preserved_count = 0
    for new_product in new_products:
        product_id = new_product.get('id')
        
        if product_id in existing_specs_map:
            preserved_data = existing_specs_map[product_id]
            if preserved_data['compatibility_specs']:
                new_product['compatibility_specs'] = preserved_data['compatibility_specs']
            if preserved_data['manual_category']:
                new_product['manual_category'] = preserved_data['manual_category']
                new_product['category'] = preserved_data['manual_category']  # Use manual category
            if preserved_data['original_category']:
                new_product['original_category'] = preserved_data['original_category']
            preserved_count += 1
    
    if preserved_count > 0:
        print(f"🛡️  Preserved compatibility specs for {preserved_count} products")
    
    return new_products

def load_frontend_data() -> Dict[str, Any]:
    """Load the frontend JSON data"""
    if not os.path.exists(FRONTEND_JSON_FILE):
        print(f"📂 No frontend data file found: {FRONTEND_JSON_FILE}")
        return {"sites": {}, "total_products": 0}
    
    try:
        with open(FRONTEND_JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            total = data.get('total_products', 0)
            last_updated = data.get('last_updated', 'Unknown')
            print(f"📂 Loaded frontend data: {total} products (last updated: {last_updated})")
            return data
    except Exception as e:
        print(f"❌ Failed to load frontend data: {e}")
        return {"sites": {}, "total_products": 0}

def update_products_cache():
    """Always scrape on startup for testing/development"""
    print("🔄 Starting initial scrape...")
    
    # Always scrape on startup (for testing/development)
    scrape_and_save_all_sites()
    print("✅ Initial startup scrape completed")

def scrape_single_site(site):
    """Scrape a single site - used for parallel execution with clean output"""
    try:
        # Map site names to display names
        display_names = {
            "globaliraq": "GlobalIraq",
            "alityan": "Alityan", 
            "kolshzin": "Kolshzin",
            "3d-iraq": "3D-Iraq",
            "jokercenter": "JokerCenter",
            "spniq": "Spniq",
            "galaxyiq": "Galaxy IQ",
            "almanjam": "Almanjam",
            "altajit": "Altajit",
            # "spniq": "spniq"  # TEMPORARILY DISABLED
        }
        
        display_name = display_names.get(site, site)
        
        products = scrape_site_individually(site)
        
        print(f"{display_name} Completed - {len(products)} products")
        print()
        
        return {site: products}
    except Exception as e:
        display_name = display_names.get(site, site)
        print(f"{display_name} Failed - {e}")
        return {site: []}

def scrape_and_save_single_site(site_name: str):
    """Scrape a single site and merge with existing data"""
    print(f"\n🔄 Scraping {site_name}...")
    start_time = time.time()
    
    try:
        products = scrape_site_individually(site_name)
        
        # Save with merge
        all_sites_data = {site_name: products}
        save_all_products_to_frontend(all_sites_data, merge=True)
        
        duration = round(time.time() - start_time, 2)
        print(f"✅ {site_name} completed in {duration}s - {len(products)} products")
        
    except Exception as e:
        print(f"❌ {site_name} failed: {e}")
        # Still try to save with empty array to trigger safety check
        all_sites_data = {site_name: []}
        save_all_products_to_frontend(all_sites_data, merge=True)

def scrape_and_save_all_sites():
    """Scrape all sites in parallel with clean output and save to frontend JSON file"""
    start_time = time.time()
    
    sites = ["globaliraq", "alityan", "kolshzin", "3d-iraq", "jokercenter", "almanjam", "spniq", "altajit"]
    all_sites_data = {}
    
    # Use ThreadPoolExecutor to scrape sites in parallel with clean output
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        # Submit all scraping tasks
        future_to_site = {executor.submit(scrape_single_site, site): site for site in sites}
        
        # Collect results as they complete
        for future in concurrent.futures.as_completed(future_to_site):
            site = future_to_site[future]
            try:
                result = future.result()
                all_sites_data.update(result)
            except Exception as e:
                print(f"❌ {site}: Exception occurred - {e}")
                all_sites_data[site] = []
    
    # Calculate total time
    end_time = time.time()
    total_duration = round(end_time - start_time, 2)
    
    # Save all data to frontend JSON file (merge mode to preserve manual retailers)
    save_all_products_to_frontend(all_sites_data, merge=True)
    print(f"✅ Parallel scraping completed in {total_duration}s")
    
    # Show summary
    total_products = sum(len(products) for products in all_sites_data.values())
    print(f"📊 Total: {total_products} products from all retailers")

# Periodic scraping function
def periodic_scrape():
    """Periodically scrape all sites and update frontend JSON file"""
    # Wait 6 hours before starting periodic scraping
    print("⏰ Periodic scraper will start in 6 hours...")
    time.sleep(6 * 60 * 60)
    
    while True:
        try:
            print("🕐 Starting periodic scrape...")
            scrape_and_save_all_sites()
            print("🕐 Periodic scrape completed. Frontend JSON file updated.")
            
        except Exception as e:
            print(f"❌ Periodic scrape failed: {e}")
        
        # Wait 6 hours before next scrape
        time.sleep(6 * 60 * 60)

def interactive_menu():
    """Interactive CLI menu for scraping"""
    print("\n" + "="*60)
    print("🛒 NexusPC Scraper - Interactive Menu")
    print("="*60)
    
    sites = {
        "1": "globaliraq",
        "2": "alityan",
        "3": "kolshzin",
        "4": "3d-iraq",
        "5": "jokercenter",
        "6": "spniq",
        "7": "galaxyiq",
        "8": "almanjam",
        "9": "altajit"
    }
    
    while True:
        print("\n📋 Choose an option:")
        print("  1. GlobalIraq")
        print("  2. Alityan")
        print("  3. Kolshzin")
        print("  4. 3D-Iraq")
        print("  5. JokerCenter")
        print("  6. Spniq")
        print("  7. Galaxy IQ")
        print("  8. Almanjam")
        print("  9. Altajit")
        print(" 10. Scrape ALL sites")
        print("  0. Exit")
        print()
        
        choice = input("Enter your choice (0-10): ").strip()
        
        if choice == "0":
            print("\n👋 Goodbye!")
            break
        elif choice == "10":
            print("\n🔄 Scraping ALL sites...")
            scrape_and_save_all_sites()
            print("\n✅ All sites scraped successfully!")
        elif choice in sites:
            site_name = sites[choice]
            scrape_and_save_single_site(site_name)
        else:
            print("\n❌ Invalid choice. Please try again.")

# Check if running in CLI mode or server mode
if __name__ == "__main__":
    import sys
    import webbrowser
    import uvicorn
    
    # Check for admin mode
    if len(sys.argv) > 1 and sys.argv[1] == "admin":
        print("🚀 NexusPC Admin Dashboard Starting...")
        print("📱 Opening admin dashboard in your browser...")
        
        # Start server in background and open browser
        def open_admin_dashboard():
            import time
            time.sleep(2)  # Wait for server to start
            webbrowser.open("http://localhost:8000/admin")
        
        import threading
        threading.Thread(target=open_admin_dashboard).start()
        
        # Start FastAPI server
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    else:
        # CLI mode - run interactive menu
        print("🚀 NexusPC Product Scraper - CLI Mode")
        print("💡 Tip: Run 'python main.py admin' for web dashboard!")
        interactive_menu()
else:
    # Server mode (when running with uvicorn)
    print("🚀 Starting NexusPC Product Aggregator...")
    
    # DISABLED: Auto-scraping for compatibility editor mode
    # threading.Thread(target=update_products_cache).start()
    # threading.Thread(target=periodic_scrape, daemon=True).start()
    
    print("✅ Server ready - API endpoints active (auto-scraping disabled)!")