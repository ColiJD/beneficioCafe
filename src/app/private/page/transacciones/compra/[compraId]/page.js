import CompraForm from "../page";

export default function EditarCompraPage({ params }) {
  const { compraId } = params;

  return <CompraForm compraId={compraId} />;
}
