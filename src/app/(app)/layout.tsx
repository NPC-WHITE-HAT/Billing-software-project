import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentBusinessContext } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getCurrentBusinessContext();

  if (!context) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <Sidebar
        business={{
          name: context.business.name,
          category: context.business.category,
        }}
        user={{
          fullName: context.user.fullName,
          email: context.user.email,
        }}
        role={context.membership.role}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          businessName={context.business.name}
          currency={context.business.currency}
        />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

