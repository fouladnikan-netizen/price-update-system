import { Link } from "react-router-dom";
import { usePublishState } from "../../publish/PublishState";
import { publicationStatusLabel } from "../../publish/publishStore";
import { ResizableTable, ResizableTh } from "../../tables/ResizableTh";

function formatPrice(value: number | null): string {
  if (value === null) return "ناموجود";
  return value.toLocaleString("fa-IR");
}

export function PublishLogPage() {
  const { publications } = usePublishState();

  return (
    <>
      <p className="muted">
        انتشار فقط با دستور انسان است. اگر کلید وب‌سایت نباشد، رکورد در صف محلی می‌ماند و کالا جدید ساخته نمی‌شود.
      </p>
      <div className="sheet table-wrap">
        <ResizableTable id="publish-log" className="price-table settings-table">
          <thead>
            <tr>
              <ResizableTh id="time">زمان</ResizableTh>
              <ResizableTh id="product">کالا</ResizableTh>
              <ResizableTh id="factory">کارخانه</ResizableTh>
              <ResizableTh id="warehouse">انبار</ResizableTh>
              <ResizableTh id="status">وضعیت</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {publications.length ? (
              publications.map((item) => (
                <tr key={item.id}>
                  <td className="cell-nowrap">{new Date(item.requestedAt).toLocaleString("fa-IR")}</td>
                  <td className="cell-wrap">
                    <strong>{item.productCode}</strong>
                    <div className="muted">{item.brandName ?? "بدون تگ"}</div>
                  </td>
                  <td>{formatPrice(item.factoryPrice)}</td>
                  <td>{formatPrice(item.warehousePrice)}</td>
                  <td>
                    <span className={`badge ${item.status === "accepted" ? "success" : item.status === "failed" || item.status === "rejected" ? "danger" : "warning"}`}>
                      {publicationStatusLabel(item.status)}
                      {item.dryRun ? " · بدون ارسال" : ""}
                    </span>
                    {item.errorMessage ? <div className="muted">{item.errorMessage}</div> : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="muted">
                  هنوز انتشاری ثبت نشده. پس از تأیید در صف بررسی، ارسال کنترل‌شده را بزنید.
                  {" "}
                  <Link to="/review">صف بررسی</Link>
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
      </div>
    </>
  );
}
