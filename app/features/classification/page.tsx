import { ClassificationPanel } from "./ui";

export default function ClassificationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">邮件分类</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        判断邮件是 SI、BL确认、发票询问、一般询问还是垃圾邮件。
      </p>
      <ClassificationPanel />
    </div>
  );
}
