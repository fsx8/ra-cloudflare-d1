# Filter Operators

The Worker supports React-Admin Simple REST style `filter` with operator suffixes:

- Equality: `{ "status": "active" }`
- IN: `{ "id": [1, 2, 3] }`
- `*_gt`, `*_gte`, `*_lt`, `*_lte`
- `*_contains`, `*_startsWith`, `*_endsWith` (SQL `LIKE`)
- Full-text-ish search: `{ "q": "term" }` (searches configured `searchableFields`)
