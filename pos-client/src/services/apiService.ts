import axios, { AxiosInstance } from 'axios';
import { Producto, Cliente, Venta } from '../types';

class APIService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = 'http://localhost:8000/api';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para agregar token
    this.client.interceptors.request.use(async (config) => {
      const token = await window.electron.config.get('token_auth');
      if (token?.value) {
        config.headers.Authorization = `Bearer ${token.value}`;
      }
      return config;
    });
  }

  setBaseURL(url: string) {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }

  // Autenticación
  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login/', {
      username,
      password,
    });
    return response.data;
  }

  // Productos
  async getProductos(empresaId: number): Promise<Producto[]> {
    const response = await this.client.get(`/productos/`, {
      params: { empresa_id: empresaId },
    });
    return response.data;
  }

  async buscarProductoPorCodigo(codigo: string, empresaId: number): Promise<Producto> {
    const response = await this.client.get(`/productos/buscar-codigo/`, {
      params: { codigo, empresa_id: empresaId },
    });
    return response.data;
  }

  // Clientes
  async getClientes(empresaId: number): Promise<Cliente[]> {
    const response = await this.client.get(`/clientes/`, {
      params: { empresa_id: empresaId },
    });
    return response.data;
  }

  async buscarCliente(identificacion: string, empresaId: number): Promise<Cliente> {
    const response = await this.client.get(`/clientes/buscar/`, {
      params: { identificacion, empresa_id: empresaId },
    });
    return response.data;
  }

  // Ventas
  async crearVenta(venta: Venta) {
    const response = await this.client.post('/ventas/', venta);
    return response.data;
  }

  async getVentas(empresaId: number, fecha_desde?: string, fecha_hasta?: string) {
    const response = await this.client.get('/ventas/', {
      params: { empresa_id: empresaId, fecha_desde, fecha_hasta },
    });
    return response.data;
  }

  // Sincronización
  async sincronizarVenta(ventaLocal: Venta) {
    try {
      const response = await this.client.post('/ventas/sync/', ventaLocal);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async generarFactura(ventaId: number) {
    try {
      const response = await this.client.post(
        `/ventas/${ventaId}/generar_factura/`,
        {},
        { timeout: 90000 }, // SRI puede tardar hasta 30s (6 retries × 5s)
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }

  async verificarConexion(): Promise<boolean> {
    try {
      await this.client.get('/health/');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const apiService = new APIService();
