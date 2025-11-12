# Migration Instructions - Adding ProductDataCache Table

## What This Does
This migration adds a new `product_data_cache` table to store temporary product comparison data in the database instead of in-memory cache. This fixes the 404 error on Railway where in-memory cache doesn't work across multiple instances.

## Steps to Deploy

### 1. Push the Updated Code to GitHub
```bash
git add app/app.py add_product_cache_table.py
git commit -m "Add database-based product cache to fix Railway 404 errors"
git push
```

### 2. Wait for Railway to Auto-Deploy
Railway will automatically detect the push and redeploy your app (takes ~1-2 minutes).

### 3. Run the Migration Script on Railway

**Option A: Using Railway CLI (Recommended)**
```bash
railway run python3 add_product_cache_table.py
```

**Option B: Using Railway Shell**
```bash
railway shell
python3 add_product_cache_table.py
exit
```

**Option C: Create a One-Time Web Endpoint**
If the CLI doesn't work, you can temporarily add this to `app/app.py` (before the `if __name__ == '__main__'` line):

```python
@app.route('/run-migration-12345')
def run_migration():
    """ONE-TIME migration endpoint - DELETE AFTER USE"""
    try:
        from datetime import datetime
        ProductDataCache.__table__.create(db.engine, checkfirst=True)
        return jsonify({'success': True, 'message': 'Migration completed!'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

Then visit: `https://your-app.up.railway.app/run-migration-12345`

**Remember to remove this endpoint after running it!**

## Verification

After running the migration, test the product search:
1. Go to your app homepage
2. Select a category and search for products
3. The comparison page should load without 404 errors

## What Changed

**Before:** Product data stored in Python dictionary (lost on restart/across instances)
**After:** Product data stored in PostgreSQL database (persists and works across all instances)

**New Database Table:**
- `id` - Primary key
- `user_id` - Foreign key to users table
- `cache_key` - Unique cache key (indexed)
- `data` - JSON product data
- `created_at` - Timestamp for auto-cleanup

**Auto-cleanup:** Entries older than 1 hour are automatically deleted on new cache writes.
