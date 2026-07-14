# Migration Guide

This provider follows the React-Admin Simple REST dialect:

- List: `GET /api/:resource?sort=...&range=...&filter=...`
- Bulk update/delete: `POST /api/:resource/__bulkUpdate` / `__bulkDelete`

If you currently use `ra-data-simple-rest`, you can switch the data provider to `createD1DataProvider`.
