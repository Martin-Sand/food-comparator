import csv
import os

# Add is_active column to categories.csv
csv_path = os.path.join(os.path.dirname(__file__), 'app', 'static', 'categories.csv')

# Read existing data
rows = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        rows.append(row)

# Add is_active column (default to True for all existing categories)
if 'is_active' not in fieldnames:
    fieldnames = list(fieldnames) + ['is_active']
    for row in rows:
        row['is_active'] = 'True'
    
    # Write back to file
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✓ Added is_active column to categories.csv")
    print(f"✓ Set all {len(rows)} categories to active by default")
else:
    print("is_active column already exists!")
