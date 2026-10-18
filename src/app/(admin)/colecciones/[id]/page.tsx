import CatalogoDetallePage from '@/components/ui-custom/catalogo-detalle-page';

export default function ColeccionPage({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogoDetallePage tipo="coleccion" params={params} />;
}
