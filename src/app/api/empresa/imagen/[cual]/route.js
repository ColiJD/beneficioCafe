import { getEmpresa, getImagenEmpresa } from "@/lib/empresa";

// Pública (la usa el login). Sirve la imagen guardada en la base; sin imagen, una genérica con la inicial del nombre.
export async function GET(_req, { params }) {
  const { cual } = await params;
  if (cual !== "logo" && cual !== "icono") return new Response("No encontrado", { status: 404 });
  const img = await getImagenEmpresa(cual);
  if (img) return new Response(img.datos, { headers: { "Content-Type": img.tipo, "Cache-Control": "public, max-age=300" } });

  const inicial = ((await getEmpresa()).nombre.trim()[0] || "?").toUpperCase().replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="#6b4f3a"/><text x="100" y="135" font-family="Arial" font-size="110" font-weight="700" text-anchor="middle" fill="#fff">${inicial}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
}
