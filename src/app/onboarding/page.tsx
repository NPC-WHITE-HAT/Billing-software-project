import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentBusinessContext } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const metadata = {
  title: "Shop Onboarding | Qelanto Business OS",
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  // Check if business already exists
  const existing = await getCurrentBusinessContext();
  if (existing) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 selection:text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full">
        <OnboardingForm userEmail={user.email || ""} />
      </div>
    </main>
  );
}

