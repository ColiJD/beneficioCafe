"use client";
import DashboardLayout from "@/components/MenuAnt";
import RegistroVisitas from "@/components/RegistroVisitas";

export default function PrivateLayout({ children }) {
  return <DashboardLayout>
      <RegistroVisitas />
      {children}
    </DashboardLayout>;
}
