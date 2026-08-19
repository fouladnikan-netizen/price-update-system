import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CatalogProduct } from "../mock/catalog";
import {
  activeManufacturersForProduct,
  applyManufacturerForm,
  isBrandActiveOnProduct,
  loadProducerTagState,
  manufacturersForCategory,
  manufacturersWithOverrides,
  saveProducerTagState,
  setBulkProductBrandTag,
  setOfficialName,
  setProductBrandTag,
  type Manufacturer,
  type ManufacturerFormInput,
  type ManufacturerFormResult,
  type ProducerTagState,
} from "./producerStore";

type ProducerContextValue = {
  state: ProducerTagState;
  manufacturers: Manufacturer[];
  manufacturersInCategory: (groupCode: string, categoryCode: string) => Manufacturer[];
  activeForProduct: (product: CatalogProduct) => Manufacturer[];
  isBrandActive: (product: CatalogProduct, brandId: string) => boolean;
  setOfficial: (manufacturerId: string, officialName: string) => void;
  setTag: (product: CatalogProduct, brandId: string, active: boolean) => void;
  setTagsBulk: (products: CatalogProduct[], brandId: string, active: boolean) => void;
  submitManufacturerForm: (input: ManufacturerFormInput) => ManufacturerFormResult;
};

const ProducerContext = createContext<ProducerContextValue | null>(null);

export function ProducerStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProducerTagState>(() => loadProducerTagState());

  const commit = useCallback((next: ProducerTagState) => {
    setState(next);
    saveProducerTagState(next);
  }, []);

  const value = useMemo<ProducerContextValue>(
    () => ({
      state,
      manufacturers: manufacturersWithOverrides(state),
      manufacturersInCategory: (groupCode, categoryCode) =>
        manufacturersForCategory(state, groupCode, categoryCode),
      activeForProduct: (product) => activeManufacturersForProduct(state, product),
      isBrandActive: (product, brandId) => isBrandActiveOnProduct(state, product, brandId),
      setOfficial: (manufacturerId, officialName) => commit(setOfficialName(state, manufacturerId, officialName)),
      setTag: (product, brandId, active) => commit(setProductBrandTag(state, product, brandId, active)),
      setTagsBulk: (products, brandId, active) =>
        commit(setBulkProductBrandTag(state, products, brandId, active)),
      submitManufacturerForm: (input) => {
        const applied = applyManufacturerForm(state, input);
        if (applied.result.ok) commit(applied.state);
        return applied.result;
      },
    }),
    [commit, state],
  );

  return <ProducerContext.Provider value={value}>{children}</ProducerContext.Provider>;
}

export function useProducerState(): ProducerContextValue {
  const value = useContext(ProducerContext);
  if (!value) throw new Error("ProducerStateProvider is missing");
  return value;
}
