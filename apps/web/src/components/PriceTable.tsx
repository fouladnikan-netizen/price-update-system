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

type Props = {
  products: CatalogProduct[];
  brandLabel: string;
  sizeColumnLabel?: string;
  onDetails: (product: CatalogProduct) => void;
};

const SHEET_EXCEL_KEYS: Array<keyof ExcelCatalogFields> = ["kind", "dimensions", "size", "weight", "unit"];

export function PriceTable({ products, brandLabel, sizeColumnLabel, onDetails }: Props) {
  const showExcelSheet = isSheetCategory(products[0]?.groupCode);
  if (showExcelSheet) {
    return <SheetExcelPriceTable products={products} brandLabel={brandLabel} onDetails={onDetails} />;
  }
  const columnLabel =
    sizeColumnLabel ?? productSizeColumnLabel(products[0]?.groupCode, products[0]?.categoryCode);
  return (
    <div className="sheet">
      <div className="sheet-meta">
        <span>
          نمایش: {brandLabel} — {products.length.toLocaleString("fa-IR")} کالا
        </span>
        <span>کارخانه و انبار دو نوع قیمت جدا هستند · داده غایب صفر نیست</span>
      </div>
      <div className="table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th className="col-product">{columnLabel}</th>
              <th className="col-factory">قیمت کارخانه</th>
              <th className="col-warehouse">قیمت انبار</th>
              <th className="col-action">مشاهدات</th>
            </tr>
          </thead>
          <tbody>
            {products.length ? (
              products.map((product) => (
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
                    <PriceCell value={null} source={null} lane="factory" />
                  </td>
                  <td className="col-warehouse">
                    <PriceCell value={null} source={null} lane="warehouse" />
                  </td>
                  <td className="col-action">
                    <button className="btn slim" type="button" onClick={() => onDetails(product)}>
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="muted">
                  در این تب کالایی نیست.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SheetExcelPriceTable({
  products,
  brandLabel,
  onDetails,
}: {
  products: CatalogProduct[];
  brandLabel: string;
  onDetails: (product: CatalogProduct) => void;
}) {
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
        <table className="price-table">
          <thead>
            <tr>
              <th className="col-product">نام کالا</th>
              {excelColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th className="col-factory">قیمت کارخانه</th>
              <th className="col-warehouse">قیمت انبار</th>
              <th className="col-action">مشاهدات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(({ product, columns }) => (
                <tr key={`${product.sku}-${product.row}`}>
                  <td className="col-product">
                    <div className="product-name">{columns.name}</div>
                  </td>
                  {excelColumns.map((column) => (
                    <td key={column.key}>{displayExcelValue(columns[column.key])}</td>
                  ))}
                  <td className="col-factory">
                    <PriceCell value={null} source={null} lane="factory" />
                  </td>
                  <td className="col-warehouse">
                    <PriceCell value={null} source={null} lane="warehouse" />
                  </td>
                  <td className="col-action">
                    <button className="btn slim" type="button" onClick={() => onDetails(product)}>
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colSpan} className="muted">
                  در این تب کالایی نیست.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
