import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientesService } from '../../services/clientesService';
import type { Cliente } from '../../types';
import { confirmDialog } from '../../store/confirmStore';
import { toast } from '../../store/toastStore';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Mail,
  Phone,
  MapPin,
  Filter,
  Download,
} from 'lucide-react';
import ClienteModal from './ClienteModal';
import ExportButtons from '../../components/ui/ExportButtons';

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: clientesService.delete,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      if (data?.accion === 'desactivado') {
        toast.warning('Cliente desactivado', data.mensaje);
      } else {
        toast.success('Cliente eliminado');
      }
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        (err as { response?: { data?: { mensaje?: string; error?: string } } })?.response?.data?.mensaje
        || (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (status === 500
          ? 'No se pudo eliminar el cliente. Si tiene facturas, ventas u otros documentos asociados, debe conservarse el historial y marcarse como inactivo.'
          : '')
        || 'No se pudo eliminar el cliente';
      toast.error(msg);
    },
  });

  const handleCreate = () => {
    setSelectedCliente(null);
    setModalOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirmDialog(
      '¿Está seguro de eliminar este cliente?',
      'Si tiene documentos asociados, se marcará como inactivo para conservar el historial.',
      'danger',
    )) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const clientesArray = Array.isArray(clientes) ? clientes : [];
  
  const filteredClientes = clientesArray.filter((c: Cliente) =>
    c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.identificacion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-blue-50 to-sky-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 bg-clip-text text-transparent mb-2">Clientes</h1>
            <p className="text-gray-600">Gestión de clientes y contactos</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons basePath="/clientes" filename="clientes" />
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-blue-600 to-sky-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:via-blue-700 hover:to-sky-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={20} />
              <span className="font-semibold">Nuevo Cliente</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o identificación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-blue-700">
                <Filter size={18} />
                <span className="font-medium">Filtros</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors text-blue-700">
                <Download size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Clientes</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">{clientesArray.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-green-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Activos</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {clientesArray.filter((c: Cliente) => c.activo).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-yellow-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-3 rounded-xl shadow-md">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Con Email</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                {clientesArray.filter((c: Cliente) => c.email).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-sky-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-sky-500 to-sky-600 p-3 rounded-xl shadow-md">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Con Teléfono</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-sky-500 to-blue-700 bg-clip-text text-transparent">
                {clientesArray.filter((c: Cliente) => c.telefono).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-sky-50 border-b border-blue-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Identificación</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Dirección</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente: Cliente) => (
                  <tr key={cliente.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">{cliente.identificacion}</span>
                      <p className="text-xs text-gray-500">{cliente.tipo_identificacion}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{cliente.razon_social}</p>
                        {cliente.nombre_comercial && (
                          <p className="text-sm text-gray-500">{cliente.nombre_comercial}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {cliente.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail size={14} />
                            <span>{cliente.email}</span>
                          </div>
                        )}
                        {cliente.telefono && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone size={14} />
                            <span>{cliente.telefono}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cliente.direccion && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={14} className="flex-shrink-0" />
                          <span className="truncate max-w-xs">{cliente.direccion}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        cliente.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors hover:shadow-md"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors hover:shadow-md"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ClienteModal
          cliente={selectedCliente}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
