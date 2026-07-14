import { getDashboardStats, getDashboardByRange } from '@/actions/ventas';
import DashboardClient from './dashboard-client';
import { todayLocal, monthStartLocal } from '@/lib/utils';



export default async function DashboardPage() {
  const [stats, rangeData] = await Promise.all([
    getDashboardStats(),
    getDashboardByRange(monthStartLocal(), todayLocal()),
  ]);

  return (
    <DashboardClient
      initialData={rangeData ?? {
        ventas_por_dia: [], total_ventas: 0,
        total_ingresos: 0, ticket_promedio: 0, productos_vendidos: 0,
      }}
      hoyStats={{
        total_ventas: Number(stats?.hoy?.total_ventas ?? 0),
        ingresos:     Number(stats?.hoy?.ingresos ?? 0),
      }}
      mesStats={{
        total_ventas: Number(stats?.mes?.total_ventas ?? 0),
        ingresos:     Number(stats?.mes?.ingresos ?? 0),
      }}
      stockTotal={stats?.stock_total ?? 0}
    />
  );
}
