import { NextRequest, NextResponse } from "next/server";
import { runAdhocTest } from "../logic";
import { toClientError } from "@/lib/shared/request-errors";

// POST { subject?, body?, from?, si: {name,data_base64}, bl: {name,data_base64}, provider? }
// -> { classification, extraction: {si,bl}, comparison }
// 不写库、不需要 Supabase，不需要口令——给裁判临时测自己的 SI/BL 文档对用，见 SHARED_INTERFACES.md「sandbox 模块」
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 最多 3 次外部调用（分类/抽取SI/抽取BL可能各调一次模型，比对再一次），30s 留够余量
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "请求体必须是一个 JSON 对象" }, { status: 400 });
  }

  try {
    const result = await runAdhocTest(raw as Parameters<typeof runAdhocTest>[0]);
    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** 浏览器/工具直接打开这个地址时，返回接口用法说明（不执行任何处理） */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/sandbox/api",
    method: "POST",
    description:
      "拿一份你自己的 SI + BL 文档（不是仓库自带的样例）跑一次分类（可选）+ 抽取 + 比对，" +
      "不写库、不用配置 Supabase，结果用完即丢。适合评委临时换一份文档测试系统的真实能力。",
    body: {
      subject: "可选：邮件主题，给了才会跑分类",
      body: "可选：邮件正文，给了才会跑分类",
      from: "可选：发件人",
      si: '必填：{ name: "xxx.pdf", data_base64: "..." }，支持 txt/md/pdf/docx/xlsx，单文件不超过 1.5MB',
      bl: "必填：格式同 si",
      provider: "可选：claude | openai | deepseek | gemini | lmstudio | jev；不传 = 和线上默认引擎一致（规则优先，缺字段才用文本模型回退链 gemini → deepseek → … 兜底，比对用 Jev 复核）",
    },
  });
}
