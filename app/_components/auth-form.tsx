"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Demo sign-in / sign-up form: there is no real authentication behind it yet (Supabase Auth is not set up),
 * so submitting only simulates a short loading state and then opens the app.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      router.push("/dashboard");
    }, 550);
  }

  const isLogin = mode === "login";

  return (
    <div>
      <h2 className="text-2xl font-bold">{isLogin ? "Welcome back" : "Create your account"}</h2>
      <p className="mt-1.5 text-sm text-fg-muted">
        Demo only: there is no real authentication yet, so {isLogin ? "signing in" : "signing up"} opens the app directly.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {!isLogin && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Full name</span>
            <input required type="text" placeholder="Your name" autoComplete="name" className="field" />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email</span>
          <input required type="email" placeholder="you@example.com" autoComplete="email" className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Password</span>
          <input
            required
            type="password"
            placeholder="••••••••"
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="field"
          />
        </label>

        <button type="submit" disabled={loading} className="btn btn-primary w-full !py-3.5">
          {loading ? "Working…" : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-fg-muted">
        {isLogin ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-accent-strong hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-accent-strong hover:underline">
              Sign in
            </Link>
          </>
        )}
      </div>

      <Link
        href="/dashboard"
        className="mt-6 block rounded-full border border-dashed border-line-strong px-4 py-3 text-center text-sm font-medium text-fg-muted transition hover:border-accent hover:text-accent-strong"
      >
        Skip sign-in and try the demo →
      </Link>
    </div>
  );
}
