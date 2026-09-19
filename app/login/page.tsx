import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";

export const metadata: Metadata = {
  title: "登录 · Shipping Doc Verifier",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title={"登录，继续核验\n手上的单证。"}
      subtitle="演示环境：Supabase Auth 还没接上，这里先做一版可用的界面，方便队友预览完整产品形态。"
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
