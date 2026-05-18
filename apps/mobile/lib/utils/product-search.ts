export type ProductSearchable = {
  name: string;
  sku?: string | null;
  category?: { name: string } | null;
};

export function matchesProductSearch(p: ProductSearchable, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (p.name.toLowerCase().includes(s)) return true;
  const sku = (p.sku ?? "").toLowerCase();
  if (sku.includes(s)) return true;
  return (p.category?.name ?? "").toLowerCase().includes(s);
}

export function filterCustomersByName<T extends { name: string }>(customers: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return customers;
  return customers.filter((c) => c.name.toLowerCase().includes(s));
}
