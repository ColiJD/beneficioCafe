import ContratoForm from "../page";

export default async function EditarContratoPage({ params }) {
  const { contratoId } = await params; // ✅ ahora sí

  return <ContratoForm contratoID={parseInt(contratoId)} />; // usa contratoID correcto
}
