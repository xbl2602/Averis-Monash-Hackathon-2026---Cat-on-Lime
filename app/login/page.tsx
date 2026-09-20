import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";

export const metadata: Metadata = {
  title: "Sign in · Shipping Doc Verifier",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title={"Sign in and keep\nchecking your documents."}
      subtitle="Demo environment: authentication is not connected yet. This screen previews the full product experience."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
