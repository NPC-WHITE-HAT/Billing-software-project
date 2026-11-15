"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Store, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const verified = searchParams.get("verified");
  const initialError = searchParams.get("error");
  const resetSuccess = searchParams.get("reset");

  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError || "");
  const [successMessage, setSuccessMessage] = useState(
    verified ? "Email confirmed successfully. Please log in." : resetSuccess ? "Password updated successfully. Please log in." : ""
  );

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        router.push(next);
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid credentials or login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 mb-4 shadow-lg shadow-blue-500/5">
          <Store className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-blue-700">Qelanto Business OS</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign in to your retail shop workspace
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl sm:p-8">
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourshop.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in to Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Need an owner account?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-400 hover:text-blue-300 transition"
            >
              Register your retail store
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="public-auth flex min-h-screen items-center justify-center p-4 selection:bg-blue-500 selection:text-white sm:p-6">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

