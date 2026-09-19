import type { Metadata } from "next";
import { AuthShell } from "../_components/auth-shell";
import { AuthForm } from "../_components/auth-form";

export const metadata: Metadata = {
  title: "注册 · Shipping Doc Verifier",
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title={"加入团队，\n一起核验单证。"}
      subtitle="演示环境：注册暂时不会创建真实账户，提交后会直接带你进入控制台看看完整体验。"
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
