export type ProductTarget = 'facturaof1' | 'of1-admin' | 'firmador' | 'legacy';

export function getProductTarget(): ProductTarget {
  const rawTarget = (import.meta.env.VITE_APP_TARGET as string | undefined)?.trim().toLowerCase();
  return rawTarget === 'facturaof1' || rawTarget === 'of1-admin' || rawTarget === 'firmador'
    ? rawTarget
    : 'legacy';
}

export const PRODUCT_TARGET: ProductTarget = getProductTarget();

/** Routes that belong to platform ownership, not tenant FacturaOF1 operation. */
export const PLATFORM_ONLY_ROUTES = new Set([
  '/empresas',
  '/suscripciones-admin',
  '/matriz-permisos',
  '/catalogo-modulos',
  '/firmas-electronicas',
  '/firmas-electronicas/precios',
  '/firmas-electronicas/promociones',
  '/firmas-electronicas/cupones',
  '/firmador-admin',
  '/automation/leads',
]);

export const FIRMADOR_ALLOWED_PREFIXES = [
  '/',
  '/firmador',
  '/login',
  '/recuperar-password',
  '/cambiar-password',
  '/verificar-email',
  '/terminos',
  '/privacidad',
  '/solicitar-firma-electronica',
];

export function isProductRouteAllowed(pathname: string, target = PRODUCT_TARGET): boolean {
  if (target === 'firmador') {
    return FIRMADOR_ALLOWED_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (target !== 'facturaof1') return true;
  return !Array.from(PLATFORM_ONLY_ROUTES).some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
