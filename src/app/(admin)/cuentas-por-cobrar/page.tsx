import { getCuentasPorCobrar } from '@/actions/ventas';
import CuentasPorCobrarClient from './cuentas-cobrar-client';

export default async function CuentasPorCobrarPage() {
  const cuentas = await getCuentasPorCobrar();
  return <CuentasPorCobrarClient cuentas={cuentas} />;
}
