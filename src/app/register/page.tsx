"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setIsError(false);

    if (fullName.trim().length < 2) {
      setIsError(true);
      setMessage("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setIsError(true);
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setMessage("Account created successfully! Redirecting...");
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage(
          "Registration successful! Please check your email and confirm your account before logging in."
        );
      }
    } catch (error: unknown) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md space-y-5 rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-xl"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            Qelanto Business OS
          </h1>
          <p className="mt-2 text-gray-400">
            Create your owner account
          </p>
        </div>

        <input
          required
          type="text"
          placeholder="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-blue-500"
        />

        <input
          required
          type="email"
          placeholder="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-blue-500"
        />

        <input
          required
          minLength={8}
          type="password"
          placeholder="Password (minimum 8 characters)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 outline-none focus:border-blue-500"
        />

        {message && (
          <p
            role="status"
            className={`text-sm ${
              isError ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {message}
          </p>
        )}

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-lg bg-blue-600 p-3 font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="text-center text-sm text-gray-400">
          Already registered?{" "}
          <a
            href="/login"
            className="text-blue-400 hover:underline"
          >
            Login
          </a>
        </p>
      </form>
    </main>
  );
}