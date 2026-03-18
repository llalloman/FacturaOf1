/**
 * Zod validation schemas for core business forms.
 *
 * Usage with react-hook-form:
 *   import { useForm } from 'react-hook-form';
 *   import { zodResolver } from '@hookform/resolvers/zod';
 *   import { clienteSchema, type ClienteFormData } from '../../schemas/formSchemas';
 *   const { register, handleSubmit, formState: { errors } } = useForm<ClienteFormData>({
 *     resolver: zodResolver(clienteSchema),
 *   });
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Cliente
// ────────────────────────────────────────────────────────────────────────────

export const clienteSchema = z
  .object({
    tipo_identificacion: z.enum(['04', '05', '06'], {
      required_error: 'Seleccione un tipo de identificación',
    }),
    identificacion: z.string().min(1, 'La identificación es obligatoria'),
    razon_social: z.string().min(2, 'Mínimo 2 caracteres'),
    nombre_comercial: z.string().optional().default(''),
    email: z
      .string()
      .email('Email inválido')
      .or(z.literal(''))
      .optional()
      .default(''),
    telefono: z.string().max(15, 'Máximo 15 caracteres').optional().default(''),
    direccion: z.string().optional().default(''),
    activo: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_identificacion === '05' && data.identificacion.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cédula debe tener exactamente 10 dígitos',
        path: ['identificacion'],
      });
    }
    if (data.tipo_identificacion === '04' && data.identificacion.length !== 13) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El RUC debe tener exactamente 13 dígitos',
        path: ['identificacion'],
      });
    }
    if (
      (data.tipo_identificacion === '04' || data.tipo_identificacion === '05') &&
      !/^\d+$/.test(data.identificacion)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo se permiten dígitos numéricos',
        path: ['identificacion'],
      });
    }
  });

export type ClienteFormData = z.infer<typeof clienteSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Factura
// ────────────────────────────────────────────────────────────────────────────

export const detalleFacturaSchema = z.object({
  producto: z.number().min(1, 'Seleccione un producto'),
  producto_nombre: z.string().optional(),
  cantidad: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  precio_unitario: z.number().min(0, 'Precio inválido'),
  descuento: z.number().min(0).default(0),
  subtotal: z.number(),
  impuestos: z.number(),
  total: z.number(),
});

export const facturaSchema = z.object({
  cliente: z.number().min(1, 'Seleccione un cliente'),
  fecha_emision: z.string().min(1, 'Fecha de emisión requerida'),
  total_descuento: z
    .string()
    .transform((v) => parseFloat(v) || 0)
    .pipe(z.number().min(0, 'El descuento no puede ser negativo')),
  detalles: z.array(detalleFacturaSchema).min(1, 'Agregue al menos un producto'),
});

export type FacturaFormData = z.infer<typeof facturaSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Producto
// ────────────────────────────────────────────────────────────────────────────

export const productoSchema = z.object({
  codigo_principal: z.string().min(1, 'Código obligatorio'),
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  descripcion: z.string().optional().default(''),
  tipo: z.enum(['BIEN', 'SERVICIO'], {
    required_error: 'Seleccione un tipo',
  }),
  precio: z
    .string()
    .transform((v) => parseFloat(v))
    .pipe(z.number().min(0.01, 'El precio debe ser mayor a 0')),
  aplica_iva: z.boolean().default(true),
  porcentaje_iva: z.string().default('4'),
  maneja_inventario: z.boolean().default(false),
  stock_minimo: z
    .string()
    .transform((v) => parseFloat(v) || 0)
    .pipe(z.number().min(0))
    .optional(),
});

export type ProductoFormData = z.infer<typeof productoSchema>;
