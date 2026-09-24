import csv
import json
import shutil
from pathlib import Path

root = Path(r"c:\Users\sorab\Desktop\ait word automation\pricelist")
product_asset_dir = root / "productAsset"
target_images_dir = root / "assets" / "product-images"

# 1. Load user CSV
with open(root / "user_mapping.csv", "r", encoding="utf-8") as f:
    csv_rows = list(csv.DictReader(f))

# 2. Load catalog-data.js
with open(root / "catalog-data.js", "r", encoding="utf-8") as f:
    text = f.read()
data = json.loads(text[len("window.CATALOG_DATA = "):].rstrip().rstrip(";"))

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

full_product_mapping = []

for coll in data["collections"]:
    for prod in coll.get("products", []):
        page = prod.get("pdfPage")
        prod_id = prod["id"]
        prod_name = prod["name"]
        prod_model = prod.get("model", "")
        
        # Pages 52 and 53
        if page and page >= 52:
            full_product_mapping.append({
                "collection_id": coll["id"],
                "product_id": prod_id,
                "product_name": prod_name,
                "model": prod_model,
                "pdf_page": page,
                "source_file": None, # already in assets/product-images/
                "target_file": Path(prod["image"]).name,
                "target_rel_path": prod["image"],
                "status": "EXISTING_P52_P53",
                "prod_ref": prod
            })
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
            # For AIT-RPS-200, use 100W screenshot
            if not src_file and best_r["model_no"] == "AIT-RPS-200":
                src_file = "Screenshot 2026-09-22 123552.png"
                tgt_file = "AIT-RPS-200.png"
            else:
                tgt_file = best_r["new_file"]
                
            full_product_mapping.append({
                "collection_id": coll["id"],
                "product_id": prod_id,
                "product_name": prod_name,
                "model": prod_model,
                "pdf_page": page,
                "source_file": src_file,
                "target_file": tgt_file,
                "target_rel_path": f"assets/product-images/{tgt_file}",
                "status": "MATCHED",
                "prod_ref": prod
            })
        else:
            full_product_mapping.append({
                "collection_id": coll["id"],
                "product_id": prod_id,
                "product_name": prod_name,
                "model": prod_model,
                "pdf_page": page,
                "source_file": None,
                "target_file": None,
                "target_rel_path": None,
                "status": "UNMATCHED",
                "prod_ref": prod
            })

print(f"Total catalog items: {len(full_product_mapping)}")
unmatched = [m for m in full_product_mapping if m["status"] == "UNMATCHED"]
print(f"Total unmatched items: {len(unmatched)}")

matched = [m for m in full_product_mapping if m["status"] in ("MATCHED", "EXISTING_P52_P53")]
print(f"Total matched + existing items: {len(matched)}")

# Check if all source files exist in productAsset
missing_sources = []
for m in full_product_mapping:
    if m["source_file"]:
        src_path = product_asset_dir / m["source_file"]
        if not src_path.exists():
            missing_sources.append((m["product_id"], m["source_file"]))

print(f"Missing source screenshot files: {len(missing_sources)}")
if missing_sources:
    print(missing_sources[:10])
