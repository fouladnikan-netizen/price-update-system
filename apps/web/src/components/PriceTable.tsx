import { PriceCell } from "./PriceCell";
import {
  isSheetCategory,
  productSizeColumnLabel,
  productSizeLabel,
  type CatalogProduct,
} from "../mock/catalog";
import {
  catalogColumnRow,
  displayExcelValue,
  visibleExcelColumns,
  type ExcelCatalogFields,
} from "../mock/catalogColumns";
import { quotePolicyNote, quoteUnitForProduct } from "../mock/quoteUnit";
import { ResizableTable, ResizableTh } from "../tables/ResizableTh";

type PriceLookup = {
  factoryPrice: number | null;
  factorySource: string | null;
  warehousePrice: number | null;
  warehouseSource: string | null;
};

type Props = {
  products: CatalogProduct[];
  brandLabel: string;
  sizeColumnLabel?: string;
  onDetails: (product: CatalogProduct) => void;
  resolvePrice?: (product: CatalogProduct) => PriceLookup | null;
};

const SHEET_EXCEL_KEYS: Array<keyof ExcelCatalogFields> = ["kind", "dimensions", "size"];

export function PriceTable({ products, brandLabel, sizeColumnLabel, onDetails, resolvePrice }: Props) {
  const showExcelSheet = isSheetCategory(products[0]?.groupCode);
  if (showExcelSheet) {
    return (
      <SheetExcelPriceTable products={products} brandLabel={brandLabel} onDetails={onDetails} resolvePrice={resolvePrice} />
    );
  }
  return (
    <StandardPriceTable
      products={products}
      brandLabel={brandLabel}
      sizeColumnLabel={sizeColumnLabel}
      onDetails={onDetails}
      resolvePrice={resolvePrice}
    />
  );
}

function StandardPriceTable({ products, brandLabel, sizeColumnLabel, onDetails, resolvePrice }: Props) {
  const columnLabel =
    sizeColumnLabel ?? productSizeColumnLabel(products[0]?.groupCode, products[0]?.categoryCode);
  const tableId = `price:${products[0]?.groupCode ?? "all"}:std`;
  const factoryUnit = quoteUnitForProduct(products[0], "factory");
  const warehouseUnit = quoteUnitForProduct(products[0], "warehouse");
  const policyNote = quotePolicyNote(products[0]?.groupCode, products[0]?.categoryCode);
  return (
    <div className="sheet">
      <div className="sheet-meta">
        <span>
          نمایش: {brandLabel} — {products.length.toLocaleString("fa-IR")} کالا
        </span>
        <span>
          {policyNote ?? "کارخانه و انبار دو نوع قیمت جدا هستند"} · داده غایب صفر نیست
        </span>
      </div>
      <div className="table-wrap">
        <ResizableTable id={tableId} className="price-table">
          <thead>
            <tr>
              <ResizableTh id="product" className="col-product">
                {columnLabel}
              </ResizableTh>
              <ResizableTh id="factory" className="col-factory">
                قیمت کارخانه
                {factoryUnit ? <div className="muted">{factoryUnit}</div> : null}
              </ResizableTh>
              <ResizableTh id="warehouse" className="col-warehouse">
                قیمت انبار
                {warehouseUnit ? <div className="muted">{warehouseUnit}</div> : null}
              </ResizableTh>
              <ResizableTh id="action" className="col-action">
                مشاهدات
              </ResizableTh>
            </tr>
          </thead>
          <tbody>
            {products.length ? (
              products.map((product) => {
                const price = resolvePrice?.(product);
                return (
                <tr key={`${product.sku}-${product.row}`}>
                  <td className="col-product">
                    <div className="product-cell">
                      <div className="size-mark">{productSizeLabel(product)}</div>
                      <div>
                        <div className="product-name">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="col-factory">
                    <PriceCell
                      value={price?.factoryPrice ?? null}
                      source={price?.factorySource ?? null}
                      lane="factory"
                      unit={quoteUnitForProduct(product, "factory")}
                    />
                  </td>
                  <td className="col-warehouse">
                    <PriceCell
                      value={price?.warehousePrice ?? null}
                      source={price?.warehouseSource ?? null}
                      lane="warehouse"
                      unit={quoteUnitForProduct(product, "warehouse")}
                    />
                  </td>
                  <td className="col-action">
                    <button className="btn slim" type="button" onClick={() => onDetails(product)}>
                      جزئیات
                    </button>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="muted">
                  در این تب کالایی نیست.
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
      </div>
    </div>
  );
}

function SheetExcelPriceTable({
  products,
  brandLabel,
  onDetails,
  resolvePrice,
}: {
  products: CatalogProduct[];
  brandLabel: string;
  onDetails: (product: CatalogProduct) => void;
  resolvePrice?: Props["resolvePrice"];
}) {
  const tableId = `price:${products[0]?.groupCode ?? "all"}:sheet`;
  const rows = products.map((product) => ({ product, columns: catalogColumnRow(product) }));
  const excelColumns = visibleExcelColumns(rows.map(({ columns }) => columns)).filter((column) =>
    SHEET_EXCEL_KEYS.includes(column.key),
  );
  const colSpan = 2 + excelColumns.length + 3;
  return (
    <div className="sheet">
      <div className="sheet-meta">
        <span>
          نمایش: {brandLabel} — {products.length.toLocaleString("fa-IR")} کالا
        </span>
        <span>ستون‌ها مطابق کاتالوگ اکسل · NULL نمایش داده نمی‌شود</span>
      </div>
      <div className="table-wrap">
        <ResizableTable id={tableId} className="price-table">
          <thead>
            <tr>
              <ResizableTh id="name" className="col-product">
                نام کالا
              </ResizableTh>
              {excelColumns.map((column) => (
                <ResizableTh key={column.key} id={column.key}>
                  {column.label}
                </ResizableTh>
              ))}
              <ResizableTh id="factory" className="col-factory">
                قیمت کارخانه
              </ResizableTh>
              <ResizableTh id="warehouse" className="col-warehouse">
                قیمت انبار
              </ResizableTh>
              <ResizableTh id="action" className="col-action">
                مشاهدات
              </ResizableTh>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(({ product, columns }) => {
                const price = resolvePrice?.(product);
                return (
                <tr key={`${product.sku}-${product.row}`}>
                  <td className="col-product">
                    <div className="product-name">{columns.name}</div>
                  </td>
                  {excelColumns.map((column) => (
                    <td key={column.key}>{displayExcelValue(columns[column.key])}</td>
                  ))}
                  <td className="col-factory">
                    <PriceCell
                      value={price?.factoryPrice ?? null}
                      source={price?.factorySource ?? null}
                      lane="factory"
                      unit={quoteUnitForProduct(product, "factory")}
                    />
                  </td>
                  <td className="col-warehouse">
                    <PriceCell
                      value={price?.warehousePrice ?? null}
                      source={price?.warehouseSource ?? null}
                      lane="warehouse"
                      unit={quoteUnitForProduct(product, "warehouse")}
                    />
                  </td>
                  <td className="col-action">
                    <button className="btn slim" type="button" onClick={() => onDetails(product)}>
                      جزئیات
                    </button>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={colSpan} className="muted">
                  در این تب کالایی نیست.
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
      </div>
    </div>
  );
}
