import VentaForm from "../page";

export default function EditarVentaPage({ params }) {
  const { compraId } = params;

  return <VentaForm compraId={compraId} />;
}
