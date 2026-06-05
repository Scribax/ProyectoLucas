'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, Download, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function ReportesPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error) {
      toast.error('Error cargando reportes');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!stats) return;
    
    const csvContent = [
      ['Métrica', 'Valor'],
      ['Producción Hoy', stats.produccionHoy],
      ['Ventas Hoy', stats.ventasHoy],
      ['Cantidad Ventas Hoy', stats.cantidadVentasHoy],
      ['Clientes con Deuda', stats.clientesConDeuda],
      ['Gallineros Activos', stats.gallinerosActivos],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Reporte descargado');
  };

  return (
    <DashboardLayout title="Reportes">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Resumen del Día</h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600"
        >
          <Download className="w-5 h-5" />
          Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500">Producción Hoy</p>
              <p className="text-3xl font-bold text-yellow-600">{stats?.produccionHoy || 0}</p>
              <p className="text-xs text-gray-400">huevos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500">Ventas Hoy</p>
              <p className="text-3xl font-bold text-green-600">${stats?.ventasHoy?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-400">{stats?.cantidadVentasHoy || 0} ventas</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500">Clientes Deuda</p>
              <p className="text-3xl font-bold text-red-600">{stats?.clientesConDeuda || 0}</p>
              <p className="text-xs text-gray-400">pendientes</p>
            </div>
          </div>

          {/* Clientes con deuda */}
          {stats?.clientesDeudaList && stats.clientesDeudaList.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-lg mb-4">Clientes con Saldo Pendiente</h3>
              <div className="space-y-3">
                {stats.clientesDeudaList.map((cliente: any) => (
                  <div key={cliente.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div>
                      <p className="font-medium">{cliente.nombre}</p>
                      <p className="text-sm text-gray-500">{cliente.telefono}</p>
                    </div>
                    <p className="text-red-500 font-bold">${cliente.saldo?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
