import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CategoryPage } from "./pages/CategoryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IntakePage } from "./pages/IntakePage";
import { ReviewPage } from "./pages/ReviewPage";
import { AiSettingsPage } from "./pages/settings/AiSettingsPage";
import { ManufacturersPage } from "./pages/settings/ManufacturersPage";
import { ProductMatrixPage } from "./pages/settings/ProductMatrixPage";
import { SourcesPage } from "./pages/settings/SourcesPage";
import { SettingsLayout } from "./pages/settings/SettingsLayout";
import { ProducerStateProvider } from "./settings/ProducerState";
import { SourceStateProvider } from "./settings/SourceState";

export default function App() {
  return (
    <ProducerStateProvider>
      <SourceStateProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/category" element={<Navigate to="/category/rebar" replace />} />
              <Route path="/category/:groupCode" element={<CategoryPage />} />
              <Route path="/category/:groupCode/:categoryCode" element={<CategoryPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/intake" element={<IntakePage />} />
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/manufacturers" replace />} />
                <Route path="manufacturers" element={<ManufacturersPage />} />
                <Route path="products" element={<ProductMatrixPage />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="ai" element={<AiSettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SourceStateProvider>
    </ProducerStateProvider>
  );
}
