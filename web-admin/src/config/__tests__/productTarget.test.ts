import { describe, expect, it } from 'vitest';
import { isProductRouteAllowed } from '../productTarget';

describe('product route boundary', () => {
  it('hides platform administration from the FacturaOF1 artifact', () => {
    expect(isProductRouteAllowed('/empresas', 'facturaof1')).toBe(false);
    expect(isProductRouteAllowed('/firmador-admin/precios', 'facturaof1')).toBe(false);
    expect(isProductRouteAllowed('/ventas', 'facturaof1')).toBe(true);
  });

  it('keeps platform administration available to the OF1 admin artifact', () => {
    expect(isProductRouteAllowed('/empresas', 'of1-admin')).toBe(true);
  });
});
