// ProtectedButton.js
"use client";
import { useSession } from "next-auth/react";

export default function ProtectedButton({ allowedRoles = [], children }) {
  const { data: session } = useSession();

  if (!session) return null;

  const userRole = session.user?.role;
  if (!allowedRoles.includes(userRole)) return null;

  return <>{children}</>;
}
