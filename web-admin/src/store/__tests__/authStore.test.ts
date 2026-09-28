import { describe, expect, it } from 'vitest';
import { defaultEmpresaId, isPlatformIdentity, restoreActiveEmpresaId } from '../authStore';

const baseUser = {
  id: 1,
  username: 'usuario',
  email: 'usuario@example.test',
  rol: 'VENDEDOR',
  email_verificado: true,
  onboarding_completado: true,
};

describe('contexto inicial de empresa', () => {
  it('mantiene empresa legacy para usuarios operativos', () => {
    expect(defaultEmpresaId({ ...baseUser, empresa_id: 12 })).toBe(12);
  });

  it('no convierte empresa legacy en contexto para SUPER_ADMIN', () => {
    expect(defaultEmpresaId({ ...baseUser, rol: 'SUPER_ADMIN', empresa_id: 12 })).toBeNull();
  });

  it('usa membresía explícita para una identidad de plataforma', () => {
    expect(defaultEmpresaId({
      ...baseUser,
      es_plataforma: true,
      empresa_id: 12,
      membresias: [{
        id: null,
        empresa: 20,
        empresa_nombre: 'Empresa activa',
        empresa_activa: true,
        rol_empresa: 'ADMIN_EMPRESA',
        modulos: [],
        activa: true,
        predeterminada: true,
      }],
    })).toBe(20);
    expect(isPlatformIdentity({ ...baseUser, es_plataforma: true })).toBe(true);
  });

  it('no rehidrata una empresa ajena desde el almacenamiento del navegador', () => {
    const platformUser = {
      ...baseUser,
      es_plataforma: true,
      membresias: [{
        id: null,
        empresa: 20,
        empresa_nombre: 'Empresa activa',
        empresa_activa: true,
        rol_empresa: 'ADMIN_EMPRESA',
        modulos: [],
        activa: true,
        predeterminada: true,
      }],
    };
    expect(restoreActiveEmpresaId(platformUser, '99')).toBeNull();
    expect(restoreActiveEmpresaId(platformUser, '20')).toBe(20);
  });
});
