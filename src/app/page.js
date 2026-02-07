import { getToken } from "next-auth/jwt";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function RootPage() {
  const cookieStore = await cookies(); // 👈 ahora sí async

  const token = await getToken({
    req: {
      cookies: Object.fromEntries(
        cookieStore.getAll().map((c) => [c.name, c.value])
      ),
    },
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) redirect("/login");

  redirect("/private");
}
