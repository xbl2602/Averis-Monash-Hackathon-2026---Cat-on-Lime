import { ExtractionPanel } from "./ui";

export default function ExtractionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">字段抽取</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        从邮件正文/附件里抽取 shipper、consignee、port of loading 等 7 个字段。
      </p>
      <ExtractionPanel />
    </div>
  );
}
