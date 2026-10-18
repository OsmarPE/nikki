import CatalogoDetallePage from '@/components/ui-custom/catalogo-detalle-page';

export default function CategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogoDetallePage tipo="categoria" params={params} />;
}
