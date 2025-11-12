def find_category_path(categories, target_id):
    """
    Given a flat list of categories (dicts with id,parent_id,name)
    and a target_id (string), returns a human-readable path like
    "Frukt & grønt > Frukt > Sitrusfrukt".
    """
    # Build maps
    by_id = {str(c['id']): c for c in categories}
    # Parent map: id -> parent_id
    parent = {}
    for c in categories:
        pid = c.get('parent_id') or ''
        parent[str(c['id'])] = str(pid)

    tid = str(target_id)
    if tid not in by_id:
        return None

    # Walk up to root
    chain = []
    cur = tid
    seen = set()
    while cur and cur in by_id and cur not in seen:
        seen.add(cur)
        chain.append(by_id[cur]['name'])
        cur = parent.get(cur) or ''
        if not cur:
            break

    # Reverse to root → leaf
    chain.reverse()
    return " > ".join(chain) if chain else None
