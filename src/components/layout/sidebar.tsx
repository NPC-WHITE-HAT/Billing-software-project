"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Package,
  Users,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  business: {
    name: string;
    category: string;
  };
  user: {
    fullName: string;
    email: string;
  };
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "Billing POS", icon: ReceiptText, badge: "F2" },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Reports & Sales", icon: BarChart3 },
  { href: "/settings", label: "Shop Settings", icon: Settings },
];

export default function Sidebar({ business, user, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const mutedText = "text-slate-500";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="z-30 flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:justify-between lg:border-b-0 lg:border-r"
    >
      <div>
        {/* Brand & Store Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-3 sm:p-4 lg:block lg:p-5">
          <div className="flex min-w-0 items-center gap-3 lg:mb-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center bg-white shrink-0">
              <Image
                src="/logo.jpg"
                alt="Qelanto Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wider uppercase text-blue-700">
                Qelanto OS
              </div>
              <div className="max-w-[150px] truncate text-sm font-bold text-slate-900">
                {business.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 lg:flex">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span className="truncate">{business.category}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className={`rounded-lg p-2 transition hover:bg-red-50 hover:text-red-600 lg:hidden ${mutedText}`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:space-y-1 lg:overflow-visible lg:p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:w-full lg:px-3.5 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : mutedText}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`hidden rounded px-1.5 py-0.5 font-mono text-[10px] font-bold sm:inline ${
                      isActive
                        ? "bg-blue-700 text-blue-100"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Card & Sign Out */}
      <div className="hidden border-t border-slate-200 bg-slate-50 p-4 lg:block">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <div className="truncate text-xs font-semibold text-slate-900">{user.fullName}</div>
            <div className={`truncate text-[11px] capitalize ${mutedText}`}>
              {role} &bull; {user.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className={`rounded-lg p-2 transition hover:bg-red-50 hover:text-red-600 ${mutedText}`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
