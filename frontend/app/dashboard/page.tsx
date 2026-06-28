'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  LayoutDashboard,
  Egg,
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Package,
  CreditCard,
  KeyRound,
  Home,
  Receipt
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Link from 'next/link';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Stats {
  produccionHoy: number;
  ventasHoy: number;
  cantidadVentasHoy: number;
  clientesConDeuda: number;
  gallinerosActivos: number;
  clientesDeudaList: any[];
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [produccionData, setProduccionData] = useState<any[]>([]);
  const [gallinerosData, setGallinerosData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, [checkAuth]);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, chartRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`, { headers }),
        axios.get(`${API_URL}/dashboard/chart-data`, { headers }),
      ]);

      setStats(statsRes.data);
      setProduccionData(chartRes.data.produccion || []);
      setGallinerosData(chartRes.data.porGallinero || []);
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', active: true },
    { icon: Home, label: 'Gallineros', href: '/gallineros' },
    { icon: Egg, label: 'Producción', href: '/produccion' },
    { icon: Package, label: 'Artículos', href: '/articulos' },
    { icon: Users, label: 'Clientes', href: '/clientes' },
    { icon: ShoppingCart, label: 'Ventas', href: '/ventas' },
    { icon: CreditCard, label: 'Facturas', href: '/facturas' },
    { icon: Receipt, label: 'Gastos', href: '/gastos' },
    { icon: TrendingUp, label: 'Reportes', href: '/reportes' },
    { icon: KeyRound, label: 'Mi cuenta', href: '/perfil' },
  ];

  const StatCard = ({ icon: Icon, title, value, color, subtitle, onClick }: any) => (
    <button onClick={onClick} className="text-left w-full">
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
    </button>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Egg className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-900 dark:text-white">Granja Avícola</h1>
                <p className="text-xs text-gray-500">{user?.name} • {user?.role}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/perfil" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Mi cuenta">
              <KeyRound className="w-5 h-5" />
            </Link>
            <button onClick={toggleTheme} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 pt-16 lg:pt-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-200`}>
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  item.active
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Overlay móvil */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-20" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={Egg}
                  title="Producción Hoy"
                  value={stats?.produccionHoy || 0}
                  color="bg-yellow-500"
                  subtitle="huevos"
                  onClick={() => router.push('/produccion')}
                />
                <StatCard
                  icon={DollarSign}
                  title="Ventas Hoy"
                  value={`$${stats?.ventasHoy?.toLocaleString() || 0}`}
                  color="bg-green-500"
                  subtitle={`${stats?.cantidadVentasHoy || 0} ventas`}
                  onClick={() => router.push('/ventas')}
                />
                <StatCard
                  icon={TrendingUp}
                  title="Gallineros"
                  value={stats?.gallinerosActivos || 0}
                  color="bg-blue-500"
                  subtitle="activos"
                  onClick={() => router.push('/gallineros')}
                />
                <StatCard
                  icon={AlertCircle}
                  title="Clientes Deuda"
                  value={stats?.clientesConDeuda || 0}
                  color="bg-red-500"
                  onClick={() => router.push('/clientes')}
                />
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Producción por día */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Producción últimos 7 días</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={produccionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="fecha" 
                          tickFormatter={(d) => {
                            try {
                              return d ? format(parseISO(d), 'dd/MM') : '';
                            } catch (error) {
                              return '';
                            }
                          }} 
                          stroke="#9ca3af" 
                        />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Line type="monotone" dataKey="total" stroke="#eab308" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Producción por gallinero */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Producción por Gallinero (mes)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gallinerosData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip />
                        <Bar dataKey="total" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/produccion" className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                  <Egg className="w-6 h-6 mb-2" />
                  <p className="font-semibold">Registrar Producción</p>
                </Link>
                <Link href="/ventas" className="bg-gradient-to-br from-green-500 to-emerald-500 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                  <ShoppingCart className="w-6 h-6 mb-2" />
                  <p className="font-semibold">Nueva Venta</p>
                </Link>
                <Link href="/clientes" className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                  <Users className="w-6 h-6 mb-2" />
                  <p className="font-semibold">Ver Clientes</p>
                </Link>
                <Link href="/reportes" className="bg-gradient-to-br from-purple-500 to-pink-500 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                  <Package className="w-6 h-6 mb-2" />
                  <p className="font-semibold">Reportes</p>
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
