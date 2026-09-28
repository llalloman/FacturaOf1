export const PRODUCT_LINKS = {
  facturaof1: (import.meta.env.VITE_FACTURAOF1_URL as string | undefined) || 'http://localhost:5176',
  of1Admin: (import.meta.env.VITE_OF1_ADMIN_URL as string | undefined) || 'http://localhost:5177',
  firmador: (import.meta.env.VITE_FIRMADOR_URL as string | undefined) || 'http://localhost:5178',
} as const;

/** Enlaces informativos; cada producto inicia su propia sesión y contexto. */
export function productLinksForUser(currentTarget: string, canManagePlatform: boolean) {
  return [
    currentTarget !== 'facturaof1' ? { label: 'FacturaOF1', href: PRODUCT_LINKS.facturaof1 } : null,
    canManagePlatform && currentTarget !== 'of1-admin'
      ? { label: 'Administración OF1', href: PRODUCT_LINKS.of1Admin }
      : null,
    currentTarget !== 'firmador' ? { label: 'Firmador', href: PRODUCT_LINKS.firmador } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;
}
