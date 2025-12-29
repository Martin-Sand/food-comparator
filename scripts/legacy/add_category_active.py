"""Legacy helper script.

Original purpose: add `is_active` column to `app/static/categories.csv`.
You should not need this once the CSV already contains the column.
"""

import csv
import os

csv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'static', 'categories.csv')

rows = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        rows.append(row)

if fieldnames and 'is_active' not in fieldnames:
    fieldnames = list(fieldnames) + ['is_active']
    for row in rows:
        row['is_active'] = 'True'

    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print("✓ Added is_active column to categories.csv")
    print(f"✓ Set all {len(rows)} categories to active by default")
else:
    print("is_active column already exists!")
