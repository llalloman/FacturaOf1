import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { suscripcionesService } from '../../services/suscripcionesService';
import { MODULOS } from '../../constants/modulos';
import { Shield, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

// Group modules for display
const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

export default function MatrizPermisosPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [saving, setSaving] = useState<number | null>(null);

  // Fetch all plans
  const { data: planes = [], isLoading: loadingPlanes } = useQuery({
    queryKey: ['planes-suscripcion'],
    queryFn: () => suscripcionesService.getTodosPlanes(),
  });

  // Fetch modulos per plan (one query per plan)
  const modulosQueries = useQuery({
    queryKey: ['planes-modulos', planes.map((p: any) => p.id)],
    queryFn: async () => {
      if (!planes.length) return {};
      const results: Record<number, string[]> = {};
      await Promise.all(
        planes.map(async (plan: any) => {
          const modulos = await suscripcionesService.getModulosPlan(plan.id);
          results[plan.id] = modulos ?? [];
        })
      );
      return results;
    },
    enabled: planes.length > 0,
  });

  const [localMatrix, setLocalMatrix] = useState<Record<number, Set<string>>>({});

  // Init local matrix once data arrives
  const matrix: Record<number, Set<string>> = {};
  if (modulosQueries.data) {
    for (const plan of planes as any[]) {
      matrix[plan.id] =
        localMatrix[plan.id] !== undefined
          ? localMatrix[plan.id]
          : new Set(modulosQueries.data[plan.id] ?? []);
    }
  }

  const toggle = (planId: number, codigo: string) => {
    setLocalMatrix((prev) => {
      const current = new Set(prev[planId] ?? modulosQueries.data?.[planId] ?? []);
      if (current.has(codigo)) {
        current.delete(codigo);
      } else {
        current.add(codigo);
      }
      return { ...prev, [planId]: current };
    });
  };

  const toggleAll = (planId: number, checked: boolean) => {
    setLocalMatrix((prev) => ({
      ...prev,
      [planId]: checked ? new Set(MODULOS.map((m) => m.codigo)) : new Set(),
    }));
  };

  const savePlan = async (plan: any) => {
    setSaving(plan.id);
    try {
      const modulos = [...(matrix[plan.id] ?? [])];
      await suscripcionesService.setModulosPlan(plan.id, modulos);
      queryClient.invalidateQueries({ queryKey: ['planes-modulos'] });
      setLocalMatrix((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      showToast(`Permisos de ${plan.nombre} guardados`, 'success');
    } catch {
      showToast('Error al guardar permisos', 'error');
    } finally {
      setSaving(null);
    }
  };

  const isLoading = loadingPlanes || modulosQueries.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const planesArr = planes as any[];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Shield className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matriz de Permisos por Módulo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define qué módulos están disponibles para cada plan de suscripción
          </p>
        </div>
      </div>

      {/* Matrix table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-4 text-sm font-semibold text-gray-600 w-52 sticky left-0 bg-white z-10">
                Módulo
              </th>
              {planesArr.map((plan) => (
                <th key={plan.id} className="px-4 py-4 text-center min-w-[140px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-bold text-gray-800">{plan.nombre}</span>
                    <span className="text-xs text-gray-400">{plan.tipo}</span>
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        className="rounded accent-blue-600"
                        checked={
                          matrix[plan.id]
                            ? MODULOS.every((m) => matrix[plan.id]?.has(m.codigo))
                            : false
                        }
                        onChange={(e) => toggleAll(plan.id, e.target.checked)}
                      />
                      Todos
                    </label>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => {
              const modulosGrupo = MODULOS.filter((m) => m.grupo === grupo);
              return (
                <>
                  {/* Group header row */}
                  <tr key={`grupo-${grupo}`} className="bg-gray-50">
                    <td
                      colSpan={planesArr.length + 1}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 sticky left-0"
                    >
                      {grupo}
                    </td>
                  </tr>
                  {/* Module rows */}
                  {modulosGrupo.map((mod) => (
                    <tr
                      key={mod.codigo}
                      className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium sticky left-0 bg-white">
                        {mod.label}
                      </td>
                      {planesArr.map((plan) => {
                        const checked = matrix[plan.id]?.has(mod.codigo) ?? false;
                        return (
                          <td key={plan.id} className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggle(plan.id, mod.codigo)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                checked
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                  : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                              }`}
                              title={`${checked ? 'Quitar' : 'Dar'} acceso a ${mod.label} en plan ${plan.nombre}`}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save buttons per plan */}
      <div className="flex flex-wrap gap-3">
        {planesArr.map((plan) => {
          const hasChanges =
            localMatrix[plan.id] !== undefined;
          return (
            <button
              key={plan.id}
              onClick={() => savePlan(plan)}
              disabled={!hasChanges || saving === plan.id}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                hasChanges && saving !== plan.id
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving === plan.id ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Guardar {plan.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
