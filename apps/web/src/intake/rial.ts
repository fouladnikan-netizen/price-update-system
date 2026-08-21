const TOMAN_TO_RIAL = 10;
const VAT = 1.1;
const THOUSAND = 1000;
const ALREADY_RIAL = 200_000;

export function roundRialToThousands(rial: number): number {
  return Math.round(rial / THOUSAND) * THOUSAND;
}

function looksLikeRial(amount: number, unit?: string | null): boolean {
  if (unit === "rial_per_kg" || unit === "rial_per_bar") return true;
  if (unit === "toman_per_kg" || unit === "toman_per_bar") return false;
  return amount >= ALREADY_RIAL;
}

export function toRegisteredRial(amount: number | null | undefined, unit?: string | null): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const rial = looksLikeRial(amount, unit) ? amount : amount * TOMAN_TO_RIAL * VAT;
  return roundRialToThousands(rial);
}
