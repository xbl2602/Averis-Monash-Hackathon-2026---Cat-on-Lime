import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";

export const metadata: Metadata = {
  title: "Create account · Shipping Doc Verifier",
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title={"Join your team.\nVerify with confidence."}
      subtitle="Demo environment: sign-up does not create a real account yet. Submitting takes you straight into the app."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
