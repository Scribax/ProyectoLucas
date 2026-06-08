// Tipos del Sistema de Gestión Avícola
import { Request } from 'express';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'empleado' | 'invitado';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Gallinero {
  id: string;
  name: string;
  description?: string;
  chicken_count: number;
  status: 'activo' | 'inactivo' | 'mantenimiento';
  created_at: Date;
  updated_at: Date;
}

export type EggSize = 'S' | 'M' | 'L' | 'XL';

export interface Produccion {
  id: string;
  gallinero_id: string;
  fecha: string;
  size: EggSize;
  cantidad: number;
  created_by?: string;
  created_at: Date;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
  saldo: number;
  is_active: boolean;
  created_at: Date;
}

export interface Venta {
  id: string;
  cliente_id: string;
  cliente?: Cliente;
  fecha: Date;
  items: VentaItem[];
  total: number;
  pagado: number;
  saldo: number;
  estado: 'pagada' | 'parcial' | 'pendiente';
  observaciones?: string;
  invoice_generated: boolean;
  invoice_path?: string;
  created_by?: string;
  created_at: Date;
}

export interface VentaItem {
  id: string;
  venta_id: string;
  size: EggSize;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Pago {
  id: string;
  cliente_id: string;
  venta_id?: string;
  monto: number;
  fecha: Date;
  metodo: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
  observaciones?: string;
  created_by?: string;
  created_at: Date;
}

export interface Gasto {
  id: string;
  categoria: 'alimento' | 'cartones' | 'transporte' | 'medicamentos' | 'mantenimiento' | 'servicios' | 'otros';
  descripcion: string;
  monto: number;
  fecha: string;
  created_by?: string;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// Tipos para requests/ responses
export interface AuthRequest extends Request {
  user?: User;
}

export interface DashboardStats {
  produccionHoy: number;
  produccionSemana: number;
  produccionMes: number;
  ventasHoy: number;
  ventasMes: number;
  gastosMes: number;
  gananciaEstimada: number;
  clientesDeuda: number;
  gallineroTop: string;
  sizeTop: string;
}

export interface ProduccionDiaria {
  fecha: string;
  gallinero_id: string;
  gallinero_name: string;
  huevos_s: number;
  huevos_m: number;
  huevos_l: number;
  huevos_xl: number;
  total_huevos: number;
}
