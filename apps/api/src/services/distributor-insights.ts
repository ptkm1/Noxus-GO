import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";

const DAY_MS = 86_400_000;

/** Dias sem pedido confirmado na carteira → aparece como “precisa ir ao cliente”. */
export const VISIT_PROXY_DAYS = 14;

/** Produto sem venda confirmada há pelo menos tantos dias. */
export const STAGNANT_PRODUCT_DAYS = 30;

/** Cliente sem compra confirmada há pelo menos tantos dias. */
export const CHURN_CUSTOMER_DAYS = 30;

export type TodaySellerRank = {
  sellerId: string;
  name: string;
  orderCount: number;
  totalAmount: number;
};

export type TodayProductRank = {
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  orderCount: number;
};

export type TodaySupplierRank = {
  supplierId: string | null;
  tradeName: string;
  quantity: number;
  totalAmount: number;
  orderCount: number;
};

export type DistributorInsights = {
  generatedAt: string;
  hints: {
    visitProxyDays: number;
    stagnantProductDays: number;
    churnCustomerDays: number;
    note: string;
  };
  today: {
    label: string;
    /** Ranking do dia por vendedor (maior faturamento primeiro). */
    sellers: TodaySellerRank[];
    /** Ranking do dia por produto. */
    products: TodayProductRank[];
    /** Ranking do dia por fornecedor. */
    suppliers: TodaySupplierRank[];
  };
  /** Vendedores ativos sem nenhum pedido confirmado hoje (sem positivação). */
  sellersWithoutPositivacaoToday: Array<{ sellerId: string; name: string }>;
  /** Vendedores ativos sem nenhum cliente vinculado. */
  sellersWithoutCustomers: Array<{ sellerId: string; name: string }>;
  /** Vendedores com clientes na carteira há tempo sem compra confirmada (proxy de visita). */
  sellersPortfolioAttention: Array<{
    sellerId: string;
    name: string;
    staleCustomersCount: number;
    assignedCustomersCount: number;
    worstCustomerDays: number | null;
    worstCustomerName: string | null;
  }>;
  stagnantProducts: Array<{
    productId: string;
    name: string;
    sku: string | null;
    daysSinceLastSale: number | null;
    lastSaleAt: string | null;
    neverSold: boolean;
  }>;
  churnCustomers: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
    daysSinceLastPurchase: number | null;
    lastPurchaseAt: string | null;
    neverPurchased: boolean;
  }>;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Dia civil local (mesmo critério que métricas MTD em seller-metrics). */
export function calendarDayBounds(at: Date): { start: Date; end: Date } {
  const y = at.getFullYear();
  const m = at.getMonth();
  const d = at.getDate();
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  return { start, end };
}

async function candidateProductIds(organizationId: string): Promise<string[]> {
  const fromAssignments = await prisma.sellerProduct.findMany({
    where: { seller: { organizationId }, product: { organizationId } },
    distinct: ["productId"],
    select: { productId: true },
  });
  const fromOrders = await prisma.orderItem.findMany({
    where: { order: { organizationId, status: "CONFIRMED" } },
    distinct: ["productId"],
    select: { productId: true },
  });
  const ids = [...new Set([...fromAssignments.map((x) => x.productId), ...fromOrders.map((x) => x.productId)])];
  if (ids.length > 0) return ids;
  const fallback = await prisma.product.findMany({
    where: { organizationId },
    select: { id: true },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });
  return fallback.map((p) => p.id);
}

export async function buildDistributorInsights(
  organizationId: string,
  now: Date = new Date(),
): Promise<DistributorInsights> {
  const visitCutoff = new Date(now.getTime() - VISIT_PROXY_DAYS * DAY_MS);
  const stagnantCutoff = new Date(now.getTime() - STAGNANT_PRODUCT_DAYS * DAY_MS);
  const churnCutoff = new Date(now.getTime() - CHURN_CUSTOMER_DAYS * DAY_MS);
  const newCustomerGrace = new Date(now.getTime() - CHURN_CUSTOMER_DAYS * DAY_MS);

  const day = calendarDayBounds(now);

  const [
    activeSellers,
    sellerCustomerLast,
    todayAgg,
    todayOrders,
    customers,
    ordersPerCustomer,
  ] = await Promise.all([
    prisma.seller.findMany({
      where: { organizationId, active: true },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.groupBy({
      by: ["sellerId", "customerId"],
      where: {
        organizationId,
        status: "CONFIRMED",
        customerId: { not: null },
      },
      _max: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["sellerId"],
      where: {
        organizationId,
        status: "CONFIRMED",
        createdAt: {
          gte: day.start,
          lte: day.end,
        },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: {
        organizationId,
        status: "CONFIRMED",
        createdAt: { gte: day.start, lte: day.end },
      },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            productId: true,
            productName: true,
            product: {
              select: {
                supplierId: true,
                supplier: { select: { id: true, tradeName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.customer.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        sellerId: true,
        createdAt: true,
        seller: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: {
        organizationId,
        status: "CONFIRMED",
        customerId: { not: null },
      },
      _max: { createdAt: true },
    }),
  ]);

  const pairLast = new Map<string, Date>();
  for (const row of sellerCustomerLast) {
    if (!row.customerId) continue;
    const maxDate = row._max.createdAt;
    if (!maxDate) continue;
    pairLast.set(`${row.sellerId}:${row.customerId}`, maxDate);
  }

  const todayBySeller = new Map(
    todayAgg.map((g) => [
      g.sellerId,
      { orderCount: g._count, totalAmount: roundMoney(decToNum(g._sum.totalAmount ?? 0)) },
    ]),
  );

  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const todaySellers = activeSellers.map((s) => {
    const row = todayBySeller.get(s.id);
    return {
      sellerId: s.id,
      name: s.user.name,
      orderCount: row?.orderCount ?? 0,
      totalAmount: row?.totalAmount ?? 0,
    };
  });
  todaySellers.sort(
    (a, b) =>
      b.totalAmount - a.totalAmount ||
      b.orderCount - a.orderCount ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const sellersWithoutPositivacaoToday = todaySellers
    .filter((s) => s.orderCount === 0)
    .map((s) => ({ sellerId: s.sellerId, name: s.name }));

  type ProductAgg = {
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: number;
    orderIds: Set<string>;
  };
  type SupplierAgg = {
    supplierId: string | null;
    tradeName: string;
    quantity: number;
    totalAmount: number;
    orderIds: Set<string>;
  };

  const productMap = new Map<string, ProductAgg>();
  const supplierMap = new Map<string, SupplierAgg>();

  for (const order of todayOrders) {
    for (const item of order.items) {
      const lineTotal = roundMoney(item.quantity * decToNum(item.unitPrice));
      const pKey = item.productId;
      const pPrev = productMap.get(pKey) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalAmount: 0,
        orderIds: new Set<string>(),
      };
      pPrev.quantity += item.quantity;
      pPrev.totalAmount = roundMoney(pPrev.totalAmount + lineTotal);
      pPrev.orderIds.add(order.id);
      productMap.set(pKey, pPrev);

      const supplierId = item.product.supplierId ?? null;
      const sKey = supplierId ?? "__none__";
      const sPrev = supplierMap.get(sKey) ?? {
        supplierId,
        tradeName: item.product.supplier?.tradeName ?? "Sem fornecedor",
        quantity: 0,
        totalAmount: 0,
        orderIds: new Set<string>(),
      };
      sPrev.quantity += item.quantity;
      sPrev.totalAmount = roundMoney(sPrev.totalAmount + lineTotal);
      sPrev.orderIds.add(order.id);
      supplierMap.set(sKey, sPrev);
    }
  }

  const todayProducts: TodayProductRank[] = [...productMap.values()]
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      quantity: p.quantity,
      totalAmount: p.totalAmount,
      orderCount: p.orderIds.size,
    }))
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount ||
        b.quantity - a.quantity ||
        a.productName.localeCompare(b.productName, "pt-BR"),
    )
    .slice(0, 40);

  const todaySuppliers: TodaySupplierRank[] = [...supplierMap.values()]
    .map((s) => ({
      supplierId: s.supplierId,
      tradeName: s.tradeName,
      quantity: s.quantity,
      totalAmount: s.totalAmount,
      orderCount: s.orderIds.size,
    }))
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount ||
        b.quantity - a.quantity ||
        a.tradeName.localeCompare(b.tradeName, "pt-BR"),
    )
    .slice(0, 40);

  const sellersPortfolioAttention: DistributorInsights["sellersPortfolioAttention"] = [];
  const sellersWithoutCustomers: DistributorInsights["sellersWithoutCustomers"] = [];

  for (const seller of activeSellers) {
    const portfolio = customers.filter((c) => c.sellerId === seller.id);
    if (portfolio.length === 0) {
      sellersWithoutCustomers.push({ sellerId: seller.id, name: seller.user.name });
      continue;
    }

    let staleCustomersCount = 0;
    let worstDays: number | null = null;
    let worstCustomerName: string | null = null;

    for (const c of portfolio) {
      const last = pairLast.get(`${seller.id}:${c.id}`);
      const isStale = !last || last < visitCutoff;
      if (!isStale) continue;
      staleCustomersCount++;
      const daysSince = last
        ? Math.floor((now.getTime() - last.getTime()) / DAY_MS)
        : Math.floor((now.getTime() - c.createdAt.getTime()) / DAY_MS);
      if (worstDays === null || daysSince > worstDays) {
        worstDays = daysSince;
        worstCustomerName = c.name;
      }
    }

    if (staleCustomersCount > 0) {
      sellersPortfolioAttention.push({
        sellerId: seller.id,
        name: seller.user.name,
        staleCustomersCount,
        assignedCustomersCount: portfolio.length,
        worstCustomerDays: worstDays,
        worstCustomerName,
      });
    }
  }

  sellersPortfolioAttention.sort((a, b) => b.staleCustomersCount - a.staleCustomersCount);

  const lastSaleByProductRows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        organizationId,
        status: "CONFIRMED",
      },
    },
    _max: { createdAt: true },
  });
  const lastSaleByProduct = new Map<string, Date>();
  for (const r of lastSaleByProductRows) {
    const d = r._max.createdAt;
    if (d) lastSaleByProduct.set(r.productId, d);
  }

  const candidateIds = await candidateProductIds(organizationId);
  const products = await prisma.product.findMany({
    where: { organizationId, id: { in: candidateIds } },
    select: { id: true, name: true, sku: true, createdAt: true },
  });

  type StRow = DistributorInsights["stagnantProducts"][number];
  const stagnantScratch: StRow[] = [];

  for (const p of products) {
    const lastSale = lastSaleByProduct.get(p.id);
    const neverSold = !lastSale;
    if (neverSold) {
      if (p.createdAt > stagnantCutoff) continue;
      stagnantScratch.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        daysSinceLastSale: null,
        lastSaleAt: null,
        neverSold: true,
      });
      continue;
    }
    if (lastSale >= stagnantCutoff) continue;
    const daysSinceLastSale = Math.floor((now.getTime() - lastSale.getTime()) / DAY_MS);
    stagnantScratch.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      daysSinceLastSale,
      lastSaleAt: lastSale.toISOString(),
      neverSold: false,
    });
  }

  stagnantScratch.sort((a, b) => {
    const score = (x: StRow) =>
      x.neverSold ? Number.MAX_SAFE_INTEGER : (x.daysSinceLastSale ?? 0);
    return score(b) - score(a);
  });
  const stagnantProducts = stagnantScratch.slice(0, 35);

  const lastPurchaseMap = new Map<string, Date>();
  for (const row of ordersPerCustomer) {
    if (!row.customerId) continue;
    const d = row._max.createdAt;
    if (d) lastPurchaseMap.set(row.customerId, d);
  }

  type ChRow = DistributorInsights["churnCustomers"][number];
  const churnScratch: ChRow[] = [];

  for (const c of customers) {
    if (c.createdAt > newCustomerGrace) continue;
    const lastPur = lastPurchaseMap.get(c.id);
    const churned = !lastPur || lastPur < churnCutoff;
    if (!churned) continue;
    churnScratch.push({
      customerId: c.id,
      name: c.name,
      sellerName: c.seller?.user.name ?? null,
      daysSinceLastPurchase: lastPur
        ? Math.floor((now.getTime() - lastPur.getTime()) / DAY_MS)
        : null,
      lastPurchaseAt: lastPur?.toISOString() ?? null,
      neverPurchased: !lastPur,
    });
  }

  churnScratch.sort((a, b) => {
    const da = a.daysSinceLastPurchase ?? Number.MAX_SAFE_INTEGER;
    const db = b.daysSinceLastPurchase ?? Number.MAX_SAFE_INTEGER;
    return db - da;
  });
  const churnCustomers = churnScratch.slice(0, 40);

  return {
    generatedAt: now.toISOString(),
    hints: {
      visitProxyDays: VISIT_PROXY_DAYS,
      stagnantProductDays: STAGNANT_PRODUCT_DAYS,
      churnCustomerDays: CHURN_CUSTOMER_DAYS,
      note:
        "Não há registro de visitas no sistema: “carteira parada” usa a última venda confirmada deste vendedor para aquele cliente.",
    },
    today: {
      label: todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1),
      sellers: todaySellers,
      products: todayProducts,
      suppliers: todaySuppliers,
    },
    sellersWithoutPositivacaoToday,
    sellersWithoutCustomers,
    sellersPortfolioAttention,
    stagnantProducts,
    churnCustomers,
  };
}
