/**
 * Shared POS discount helpers.
 *
 * IVA percentage codes follow SRI Ecuador classification:
 * '0' = 0 %   '2' = 12 %   '3' = 14 %   '4' = 15 %   '6' = No objeto   '7' = Exento
 */

export type DiscountMode = 'monto' | 'porcentaje' | 'precio_final';

/** SRI IVA code → percentage (integer, e.g. 12 → 0.12 IVA rate) */
export const IVA_PCT: Record<string, number> = {
  '0': 0,
  '2': 12,
  '3': 14,
  '4': 15,
  '6': 0,
  '7': 0,
};

/** Round to 2 decimal places using symmetric rounding */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Gross line total before any discount */
export const getBruto = (cantidad: number, precioUnitario: number): number =>
  round2(cantidad * precioUnitario);

/**
 * Clamp discount to [0, bruto].
 * Prevents negative totals or discounts larger than the line value.
 */
export const clampDiscount = (descuento: number, bruto: number): number =>
  Math.max(0, Math.min(round2(descuento), bruto));

/**
 * Convert any discount mode to a monetary discount amount.
 *
 * @param mode        - Discount mode
 * @param inputValue  - Raw string value from the UI input
 * @param bruto       - Gross line total (cantidad × precioUnitario)
 * @param ivaPct      - IVA percentage integer (e.g. 12 for 12%)
 * @returns monetary discount (always ≥ 0 and ≤ bruto)
 */
export function discountToMonto(
  mode: DiscountMode,
  inputValue: string,
  bruto: number,
  ivaPct: number,
): number {
  const parsed = parseFloat(inputValue) || 0;
  switch (mode) {
    case 'monto':
      return clampDiscount(parsed, bruto);
    case 'porcentaje': {
      const pct = Math.max(0, Math.min(parsed, 100));
      return clampDiscount(round2(bruto * pct / 100), bruto);
    }
    case 'precio_final': {
      // bruto is already the pre-tax base (precio_unitario × cantidad).
      // precio_final is the amount the customer pays INCLUDING IVA.
      // Back-compute the net price and subtract from bruto.
      const ivaFactor = 1 + ivaPct / 100;
      const precioSinIva = round2(parsed / ivaFactor);
      return clampDiscount(round2(bruto - precioSinIva), bruto);
    }
  }
}
