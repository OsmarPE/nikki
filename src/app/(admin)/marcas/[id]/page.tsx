import CatalogoDetallePage from '@/components/ui-custom/catalogo-detalle-page';

export default function MarcaPage({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogoDetallePage tipo="marca" params={params} />;
}
