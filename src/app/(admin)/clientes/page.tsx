import { getClientes } from '@/actions/clientes';
import ClientesClient from './clientes-client';

export default async function ClientesPage() {
  const clientes = await getClientes();
  return <ClientesClient clientes={clientes} />;
}
