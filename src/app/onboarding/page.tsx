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
    <main className="public-auth flex min-h-screen flex-col justify-center px-4 py-8 selection:bg-blue-500 selection:text-white sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <OnboardingForm userEmail={user.email || ""} />
      </div>
    </main>
  );
}

