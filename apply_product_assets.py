import csv
import json
import shutil
from pathlib import Path
import cv2

root = Path(r"c:\Users\sorab\Desktop\ait word automation\pricelist")
product_asset_dir = root / "productAsset"
target_images_dir = root / "assets" / "product-images"
target_images_dir.mkdir(parents=True, exist_ok=True)

# 1. Backup catalog-data.js
catalog_file = root / "catalog-data.js"
backup_file = root / "catalog-data.backup.js"
shutil.copyfile(catalog_file, backup_file)
print(f"Created backup at {backup_file.name}")

# 2. Load user CSV
with open(root / "user_mapping.csv", "r", encoding="utf-8") as f:
    csv_rows = list(csv.DictReader(f))

# 3. Load catalog-data.js
with open(catalog_file, "r", encoding="utf-8") as f:
    text = f.read()
prefix = "window.CATALOG_DATA = "
data = json.loads(text[len(prefix):].rstrip().rstrip(";"))

def norm_model(m):
    if not m: return ""
    m = m.strip().upper().replace(" ", "").replace("-", "")
    m = m.replace("O", "0")
    m = m.replace("2IF", "21F")
    return m

# Build lookup by page from CSV
csv_by_page = {}
for r in csv_rows:
    if r["pdf_page"]:
        csv_by_page.setdefault(int(r["pdf_page"]), []).append(r)

stats = {
    "copied_new_file": 0,
    "copied_id_file": 0,
    "updated_catalog": 0,
    "existing_p52_p53": 0,
    "model_corrected": 0
}

copied_pairs = []

for coll in data["collections"]:
    for prod in coll.get("products", []):
        page = prod.get("pdfPage")
        prod_id = prod["id"]
        prod_name = prod["name"]
        prod_model = prod.get("model", "")
        
        # Pages 52 and 53
        if page and page >= 52:
            stats["existing_p52_p53"] += 1
            continue
            
        csv_items = csv_by_page.get(page, [])
        c_mod = norm_model(prod_model)
        c_name = prod_name.lower()
        
        best_r = None
        
        # Page 50 corner distinction
        if page == 50:
            if "t-corner" in c_name or "53" in prod_id:
                for r in csv_items:
                    if r["new_file"] == "AIT-MOR-AC.png":
                        best_r = r
                        break
            elif "a-corner" in c_name or "52" in prod_id:
                for r in csv_items:
                    if r["new_file"] == "AIT-MCR-AC.png":
                        best_r = r
                        break
                        
        # Elegance series on pages 13 and 14
        if not best_r and page in (13, 14):
            for r in csv_items:
                rf = r["new_file"].lower()
                if "knob-4-switch-socket" in rf and "knob + 4 switch" in c_name:
                    best_r = r
                    break
                elif "knob" in rf and "knob" in c_name and "4-switch" not in rf:
                    best_r = r
                    break
                elif "6-switch" in rf and "6 switch" in c_name:
                    best_r = r
                    break
                elif "8-switch" in rf and "8 switch" in c_name:
                    best_r = r
                    break
                elif "10-switch" in rf and "10 switch" in c_name:
                    best_r = r
                    break
                elif "fan" in rf and "fan" in c_name:
                    best_r = r
                    break
                elif "2s-1l-1f-2s" in rf and "4 switch + socket (4l+2s" in c_name:
                    best_r = r
                    break
                    
        # Page 10 SL vs BL
        if not best_r and page == 10:
            for r in csv_items:
                rf = r["new_file"].lower()
                if "sl" in rf and ("sl" in c_name or "silver" in c_name or "bk-5" in prod_id):
                    best_r = r
                    break
                elif "bl" in rf and ("bl" in c_name or "blue" in c_name or "bl-6" in prod_id):
                    best_r = r
                    break
                    
        # Page 51 Power supply
        if not best_r and page == 51:
            if "200" in prod_id.lower() or "2oo" in prod_id.lower() or "200w" in c_name:
                for r in csv_items:
                    if r.get("model_no") == "AIT-RPS-200":
                        best_r = r
                        break
            elif "100" in prod_id.lower() or "100w" in c_name:
                for r in csv_items:
                    if r.get("model_no") == "AIT-RPS-100":
                        best_r = r
                        break
                        
        # General model match
        if not best_r:
            for r in csv_items:
                r_mod = norm_model(r.get("model_no", ""))
                if c_mod and c_mod == r_mod:
                    best_r = r
                    break
                    
        if best_r:
            src_file = best_r["source_file"]
            if not src_file and best_r["model_no"] == "AIT-RPS-200":
                src_file = "Screenshot 2026-09-22 123552.png"
                tgt_file = "AIT-RPS-200.png"
            else:
                tgt_file = best_r["new_file"]
                
            src_path = product_asset_dir / src_file
            tgt_named_path = target_images_dir / tgt_file
            tgt_id_path = target_images_dir / f"{prod_id}.png"
            
            # Copy to target named file
            shutil.copyfile(src_path, tgt_named_path)
            stats["copied_new_file"] += 1
            
            # Also copy to prod_id.png for legacy/permalink compatibility
            shutil.copyfile(src_path, tgt_id_path)
            stats["copied_id_file"] += 1
            
            # Update product image in catalog
            old_image = prod.get("image")
            new_image = f"assets/product-images/{tgt_file}"
            prod["image"] = new_image
            stats["updated_catalog"] += 1
            
            # Fix model typos if needed (e.g. O instead of 0, MOR instead of MCR for T Corner)
            csv_model = best_r.get("model_no")
            if csv_model and csv_model != prod_model:
                prod["model"] = csv_model
                stats["model_corrected"] += 1
                
            copied_pairs.append((src_file, tgt_file, prod_id, prod_name))
        else:
            print(f"ERROR: Could not match {prod_id} on page {page}!")

# 4. Save updated catalog-data.js
output_js = prefix + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
with open(catalog_file, "w", encoding="utf-8") as f:
    f.write(output_js)

print("--- EXECUTION REPORT ---")
print(f"Total new_file images copied: {stats['copied_new_file']}")
print(f"Total id_file images copied: {stats['copied_id_file']}")
print(f"Total catalog products updated: {stats['updated_catalog']}")
print(f"Catalog products kept from pages 52-53: {stats['existing_p52_p53']}")
print(f"Model numbers normalized: {stats['model_corrected']}")
print("Saved updated catalog-data.js successfully!")
