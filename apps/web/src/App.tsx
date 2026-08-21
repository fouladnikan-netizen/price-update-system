import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CategoryPage } from "./pages/CategoryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KeysPage } from "./pages/settings/KeysPage";
import { ManufacturersPage } from "./pages/settings/ManufacturersPage";
import { ProductMatrixPage } from "./pages/settings/ProductMatrixPage";
import { SourcesPage } from "./pages/settings/SourcesPage";
import { SettingsLayout } from "./pages/settings/SettingsLayout";
import { IntakeStateProvider } from "./intake/IntakeState";
import { DailyPriceStateProvider } from "./intake/DailyPriceState";
import { PriceUpdateStateProvider } from "./intake/PriceUpdateState";
import { PublishStateProvider } from "./publish/PublishState";
import { IdentityStateProvider } from "./settings/IdentityState";
import { ProducerStateProvider } from "./settings/ProducerState";
import { SourceStateProvider } from "./settings/SourceState";

export default function App() {
  return (
    <ProducerStateProvider>
      <SourceStateProvider>
        <IdentityStateProvider>
          <IntakeStateProvider>
            <DailyPriceStateProvider>
              <PublishStateProvider>
                <PriceUpdateStateProvider>
                  <BrowserRouter>
                    <Routes>
                      <Route element={<Layout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="/category" element={<Navigate to="/category/rebar" replace />} />
                        <Route path="/category/:groupCode" element={<CategoryPage />} />
                        <Route path="/category/:groupCode/:categoryCode" element={<CategoryPage />} />
                        <Route path="/review" element={<Navigate to="/" replace />} />
                        <Route path="/compare" element={<Navigate to="/" replace />} />
                        <Route path="/intake" element={<Navigate to="/" replace />} />
                        <Route path="/collect" element={<Navigate to="/" replace />} />
                        <Route path="/settings" element={<SettingsLayout />}>
                          <Route index element={<Navigate to="/settings/manufacturers" replace />} />
                          <Route path="manufacturers" element={<ManufacturersPage />} />
                          <Route path="products" element={<ProductMatrixPage />} />
                          <Route path="sources" element={<SourcesPage />} />
                          <Route path="keys" element={<KeysPage />} />
                          <Route path="ai" element={<Navigate to="/settings/keys" replace />} />
                          <Route path="publish" element={<Navigate to="/settings/keys" replace />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Routes>
                  </BrowserRouter>
                </PriceUpdateStateProvider>
              </PublishStateProvider>
            </DailyPriceStateProvider>
          </IntakeStateProvider>
        </IdentityStateProvider>
      </SourceStateProvider>
    </ProducerStateProvider>
  );
}
