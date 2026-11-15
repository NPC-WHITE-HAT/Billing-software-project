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
    <div className="authenticated-ui flex min-h-screen flex-col bg-slate-50 text-slate-900 lg:flex-row">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          businessName={context.business.name}
          currency={context.business.currency}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
