import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileSignature, Loader2, UserPlus } from 'lucide-react';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

export default function RegistroFirmadorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({
    email: searchParams.get('email') ?? '',
    password: '',
    nombre: '',
    apellido: '',
    identificacion: '',
    workspace_nombre: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authService.registroFirmador(form);
      setAuth(response.user, response.access, response.refresh);
      navigate(response.user.email_verificado ? '/firmador' : '/verificar-email', { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string; error?: string; email?: string[] } } };
      setError(
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.error ||
        axiosError.response?.data?.email?.[0] ||
        'No se pudo crear la cuenta.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] bg-white border border-slate-100 shadow-xl rounded-lg overflow-hidden">
        <div className="bg-slate-900 text-white p-8 lg:p-10 flex flex-col justify-between gap-10">
          <div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Iniciar sesion
            </Link>
            <div className="mt-10 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-blue-600">
              <FileSignature className="w-8 h-8" />
            </div>
            <h1 className="mt-6 text-3xl font-black">Crea tu cuenta de firmador PDF</h1>
            <p className="mt-3 text-slate-300 leading-relaxed">
              Usa tu certificado electronico para firmar PDFs sin crear una empresa dentro del ERP.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-300">
            <span>Sesion obligatoria para cada firma.</span>
            <span>Descarga inmediata o guardado temporal en R2.</span>
            <span>Cuotas por archivo, almacenamiento y firmas mensuales.</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 lg:p-10 space-y-5">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Registro</h2>
            <p className="text-sm text-slate-500 mt-1">Esta cuenta tendra acceso solo al firmador.</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Nombre</span>
              <input
                value={form.nombre}
                onChange={(event) => updateField('nombre', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Apellido</span>
              <input
                value={form.apellido}
                onChange={(event) => updateField('apellido', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Correo</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Identificacion</span>
              <input
                value={form.identificacion}
                onChange={(event) => updateField('identificacion', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Nombre del espacio</span>
              <input
                value={form.workspace_nombre}
                onChange={(event) => updateField('workspace_nombre', event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Opcional"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Contrasena</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              minLength={8}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-bold text-white shadow-lg hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            Crear cuenta de firmador
          </button>
        </form>
      </section>
    </main>
  );
}
