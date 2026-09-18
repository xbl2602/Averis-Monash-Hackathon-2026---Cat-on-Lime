import { ComparisonPanel } from "./ui";

export default function ComparisonPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">比对确认</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        比对 BL 与 SI 的字段，标出差异，拿不准时提示人工介入。
      </p>
      <ComparisonPanel />
    </div>
  );
}
