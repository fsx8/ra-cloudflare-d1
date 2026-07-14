# Soft Delete

If a resource is configured with `softDelete`, list and get-one queries exclude deleted records by default.

To include deleted records, use either mechanism (both work on all routes):

- Query param: `?includeDeleted=true`
- Filter: `filter._includeDeleted = true`
