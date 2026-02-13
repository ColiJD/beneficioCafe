import ProtectedPage from "@/components/ProtectedPage";
import Menu from "@/app/private/page/menu/page";
export default function Home() {
  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES", "AUDITORES"]}
    >
      <main>
        <Menu />
      </main>
    </ProtectedPage>
  );
}
