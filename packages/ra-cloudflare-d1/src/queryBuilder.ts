export function buildListQuery(params: {
  sort: unknown;
  range: unknown;
  filter: unknown;
}) {
  const sp = new URLSearchParams();
  sp.set("sort", JSON.stringify(params.sort));
  sp.set("range", JSON.stringify(params.range));
  sp.set("filter", JSON.stringify(params.filter));
  return sp.toString();
}
