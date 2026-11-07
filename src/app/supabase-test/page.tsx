import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="rounded-xl border p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">
          Qelanto Business OS
        </h1>

        {error ? (
          <p className="text-red-600">
            Error: {error.message}
          </p>
        ) : (
          <>
            <p className="text-green-600 font-semibold">
              Supabase client initialized successfully!
            </p>
            <p className="mt-3 text-sm">
              {data?.claims
                ? "User session detected."
                : "No user logged in yet."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}