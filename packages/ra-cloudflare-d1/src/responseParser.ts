export function parseTotal(headers: Headers): number {
  const cr = headers.get("Content-Range");
  if (cr) {
    const parts = cr.split("/");
    const total = Number(parts[1]);
    if (Number.isFinite(total)) return total;
  }
  const xt = headers.get("X-Total-Count");
  if (xt) {
    const total = Number(xt);
    if (Number.isFinite(total)) return total;
  }
  return 0;
}
