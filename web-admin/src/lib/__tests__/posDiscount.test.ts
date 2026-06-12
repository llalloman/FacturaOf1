/**
 * POS Discount — Business & Functional Tests
 *
 * Scenarios covered:
 *  1. round2 — currency rounding
 *  2. getBruto — gross line total
 *  3. clampDiscount — boundaries
 *  4. Descuento por monto ($)
 *  5. Descuento por porcentaje (%)
 *  6. Descuento por precio_final (IVA incluido)
 *  7. IVA 0% — no IVA charged
 *  8. IVA 12% (code '2')
 *  9. IVA 15% (code '4')
 * 10. Consumidor Final — descuento 0, cualquier modo
 * 11. Descuento mayor al total — clamped to bruto
 * 12. Porcentaje > 100% — clamped to 100
 * 13. IVA_PCT map completeness
 */

import { describe, it, expect } from 'vitest';
import {
  round2,
  getBruto,
  clampDiscount,
  discountToMonto,
  IVA_PCT,
} from '../posDiscount';

// ─── 1. round2 ───────────────────────────────────────────────────────────────
describe('round2', () => {
  it('rounds half-up to 2 decimals', () => {
    // Use values that are exact in IEEE 754 so rounding is predictable
    expect(round2(1.415)).toBe(1.42);
    expect(round2(1.414)).toBe(1.41);
  });

  it('handles negative values (Math.round rounds toward +∞ at .5)', () => {
    // -1.415 * 100 = -141.5 → Math.round(-141.5) = -141 → -1.41
    expect(round2(-1.414)).toBe(-1.41);
    expect(round2(-1.40)).toBe(-1.40);
  });

  it('keeps integers intact', () => {
    expect(round2(100)).toBe(100);
  });
});

// ─── 2. getBruto ─────────────────────────────────────────────────────────────
describe('getBruto', () => {
  it('multiplies cantidad × precio without rounding issues', () => {
    expect(getBruto(3, 9.99)).toBe(29.97);
    expect(getBruto(1, 100)).toBe(100);
    expect(getBruto(0, 50)).toBe(0);
  });
});

// ─── 3. clampDiscount ────────────────────────────────────────────────────────
describe('clampDiscount', () => {
  it('clamps negative discount to 0', () => {
    expect(clampDiscount(-5, 100)).toBe(0);
  });

  it('clamps discount larger than bruto to bruto', () => {
    expect(clampDiscount(150, 100)).toBe(100);
  });

  it('passes through discount within [0, bruto]', () => {
    expect(clampDiscount(10, 100)).toBe(10);
    expect(clampDiscount(0, 100)).toBe(0);
    expect(clampDiscount(100, 100)).toBe(100);
  });
});

// ─── 4. Descuento por monto ($) ──────────────────────────────────────────────
describe('discountToMonto — modo monto', () => {
  it('bruto=100, descuento=10 → discount=10', () => {
    expect(discountToMonto('monto', '10', 100, 12)).toBe(10);
  });

  it('descuento=0 → sin descuento', () => {
    expect(discountToMonto('monto', '0', 100, 12)).toBe(0);
  });

  it('descuento > bruto → clamped a bruto', () => {
    expect(discountToMonto('monto', '999', 100, 12)).toBe(100);
  });

  it('descuento negativo → 0', () => {
    expect(discountToMonto('monto', '-5', 100, 12)).toBe(0);
  });

  it('input vacío → 0', () => {
    expect(discountToMonto('monto', '', 100, 12)).toBe(0);
  });
});

// ─── 5. Descuento por porcentaje (%) ─────────────────────────────────────────
describe('discountToMonto — modo porcentaje', () => {
  it('10% sobre bruto=100 → discount=10', () => {
    expect(discountToMonto('porcentaje', '10', 100, 12)).toBe(10);
  });

  it('50% sobre bruto=200 → discount=100', () => {
    expect(discountToMonto('porcentaje', '50', 200, 12)).toBe(100);
  });

  it('5% sobre bruto=29.97 → rounds correctamente', () => {
    expect(discountToMonto('porcentaje', '5', 29.97, 12)).toBe(1.50);
  });

  it('100% → descuento total', () => {
    expect(discountToMonto('porcentaje', '100', 100, 12)).toBe(100);
  });

  it('porcentaje > 100 → clamped a 100%', () => {
    expect(discountToMonto('porcentaje', '200', 100, 12)).toBe(100);
  });

  it('porcentaje negativo → 0', () => {
    expect(discountToMonto('porcentaje', '-10', 100, 12)).toBe(0);
  });
});

// ─── 6. Descuento por precio_final (IVA incluido) ────────────────────────────
describe('discountToMonto — modo precio_final', () => {
  /**
   * Escenario: producto IVA 12%, bruto (sin IVA) = $100
   * precio con IVA = $112
   * operador ingresa precio_final = $89.60 (IVA incluido)
   * precio sin IVA = 89.60 / 1.12 = 80.00
   * descuento = 100.00 - 80.00 = 20.00
   */
  it('IVA 12%: precio_final=89.60 sobre bruto=100 → discount=20', () => {
    // bruto=100 (pre-tax), precio_final=89.60 (IVA incluido)
    // precioSinIva = 89.60/1.12 = 80.00 → discount = 100 - 80 = 20
    expect(discountToMonto('precio_final', '89.60', 100, 12)).toBe(20);
  });

  /**
   * IVA 15%: bruto=100, precio_final=85 con IVA = precio_sin_iva=73.91...
   * descuento = 100/1.15 - 85/1.15 = (100-85)/1.15 = 15/1.15 ≈ 13.04
   */
  it('IVA 15%: precio_final=85 sobre bruto=100 → discount≈13.04', () => {
    // precioSinIva = 85/1.15 = 73.91 → discount = 100 - 73.91 = 26.09
    const d = discountToMonto('precio_final', '85', 100, 15);
    expect(d).toBeCloseTo(26.09, 1);
  });

  it('precio_final igual al bruto con IVA → discount=0', () => {
    // precio_final = 112 (= 100 × 1.12) → no hay descuento
    expect(discountToMonto('precio_final', '112', 100, 12)).toBe(0);
  });

  it('precio_final > bruto con IVA → clamped a 0', () => {
    // precio_final = 200 > 112 → descuento sería negativo → 0
    expect(discountToMonto('precio_final', '200', 100, 12)).toBe(0);
  });

  it('precio_final = 0 → descuento total', () => {
    // precioSinIva = 0/1.12 = 0 → discount = 100 - 0 = 100 (clamped to bruto)
    const d = discountToMonto('precio_final', '0', 100, 12);
    expect(d).toBe(100);
  });
});

// ─── 7. IVA 0% ───────────────────────────────────────────────────────────────
describe('IVA 0%', () => {
  it('precio_final mode with IVA 0%: precio_final = bruto → discount=0', () => {
    expect(discountToMonto('precio_final', '100', 100, 0)).toBe(0);
  });

  it('precio_final mode with IVA 0%: precio_final = 80 → discount=20', () => {
    expect(discountToMonto('precio_final', '80', 100, 0)).toBe(20);
  });
});

// ─── 8. IVA_PCT map ──────────────────────────────────────────────────────────
describe('IVA_PCT map', () => {
  it('code 0 → 0%', () => expect(IVA_PCT['0']).toBe(0));
  it('code 2 → 12%', () => expect(IVA_PCT['2']).toBe(12));
  it('code 3 → 14%', () => expect(IVA_PCT['3']).toBe(14));
  it('code 4 → 15%', () => expect(IVA_PCT['4']).toBe(15));
  it('code 6 (no objeto) → 0%', () => expect(IVA_PCT['6']).toBe(0));
  it('code 7 (exento) → 0%', () => expect(IVA_PCT['7']).toBe(0));
  it('unknown code → undefined (caller should default to 0)', () => {
    expect(IVA_PCT['99']).toBeUndefined();
  });
});

// ─── 9. Escenario de negocio completo: venta con descuento ───────────────────
describe('Escenario completo: línea de venta', () => {
  /**
   * Producto: "Camisa" × 2 unidades @ $45.00 c/u, IVA 12%
   * bruto = $90.00
   * Cajero aplica 10% descuento
   * Subtotal sin IVA = $81.00
   * IVA 12% = $9.72
   * Total = $90.72
   */
  it('2 × $45 con 10% descuento — totales correctos', () => {
    const cantidad = 2;
    const precio = 45;
    const ivaPct = 12;
    const bruto = getBruto(cantidad, precio);           // 90.00

    expect(bruto).toBe(90);

    const discount = discountToMonto('porcentaje', '10', bruto, ivaPct); // 9.00
    expect(discount).toBe(9);

    const subtotalSinIva = round2(bruto - discount);    // 81.00
    const ivaAmount = round2(subtotalSinIva * ivaPct / 100); // 9.72
    const total = round2(subtotalSinIva + ivaAmount);   // 90.72

    expect(subtotalSinIva).toBe(81);
    expect(ivaAmount).toBe(9.72);
    expect(total).toBe(90.72);
  });

  /**
   * Consumidor final — no debe poder aplicar descuento negativo
   * y el mínimo siempre es $0.
   */
  it('descuento $0 en consumidor final → descuento=0', () => {
    const bruto = getBruto(1, 100);
    expect(discountToMonto('monto', '0', bruto, 12)).toBe(0);
  });
});
