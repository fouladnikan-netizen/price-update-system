export type CeilingQuote = {
  factoryPrice: number | null;
  warehousePrice: number | null;
  approvedCount: number;
};

export function approvedCeiling(
  items: Array<{
    productCode: string | null;
    brandId: string | null;
    status: string;
    factoryPrice: number | null;
    warehousePrice: number | null;
  }>,
  productCode: string,
  brandId: string | null,
): CeilingQuote {
  const approved = items.filter(
    (item) =>
      item.status === "approved" &&
      item.productCode === productCode &&
      (item.brandId ?? null) === (brandId ?? null),
  );
  const factory = approved.map((item) => item.factoryPrice).filter((value): value is number => value !== null && value > 0);
  const warehouse = approved
    .map((item) => item.warehousePrice)
    .filter((value): value is number => value !== null && value > 0);
  return {
    factoryPrice: factory.length ? Math.max(...factory) : null,
    warehousePrice: warehouse.length ? Math.max(...warehouse) : null,
    approvedCount: approved.length,
  };
}
