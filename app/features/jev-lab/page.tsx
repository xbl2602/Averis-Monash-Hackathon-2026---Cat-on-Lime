import { listSampleEmails } from "@/lib/shared/inbox";
import { JevLabPanel } from "./ui";

export default async function JevLabPage() {
  const emails = await listSampleEmails();
  const options = emails.map((email) => ({
    email_id: email.email_id,
    subject: email.subject,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Jev 验证</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          用样例邮件验证 Jev（TypeSafe 结构化决策模型）的分类效果：只看固定选项里的选择、
          校准过的置信度，以及"拿不准就提示人工介入"。也可以切换 Claude 做对照。
        </p>
      </div>
      <JevLabPanel emails={options} />
    </div>
  );
}
