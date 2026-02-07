// ✅ Este archivo es un Server Component
import ResetPassword from "./ResetPasswordClient";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token || null;

  return <ResetPassword token={token} />;
}
