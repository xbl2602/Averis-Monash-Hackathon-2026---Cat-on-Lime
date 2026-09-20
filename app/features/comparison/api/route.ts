import { NextRequest, NextResponse } from "next/server";
import { compareDocuments } from "../logic";
import type { ExtractedDocumentFields } from "@/lib/shared/types";
import { isLLMProvider } from "@/lib/llm";
import { toClientError } from "@/lib/shared/request-errors";

// POST { "si": {...}, "bl": {...}, "provider": "jev" } -> ComparisonResult
// provider 可省略：不传时逐字符精确比较（不调用模型）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 单文档请求最多 1 次外部调用（20s 超时），30s 足够且能更快暴露问题
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
  const body = raw as { si?: unknown; bl?: unknown; provider?: unknown };

  if (!isPlainObject(body.si) || !isPlainObject(body.bl)) {
    return NextResponse.json({ error: "需要 si 和 bl 两个字段对象" }, { status: 400 });
  }

  const provider = body.provider;
  if (provider !== undefined && !isLLMProvider(provider)) {
    return NextResponse.json(
      { error: `不支持的 provider：${String(provider)}` },
      { status: 400 }
    );
  }

  try {
    const result = await compareDocuments({
      si: body.si as ExtractedDocumentFields,
      bl: body.bl as ExtractedDocumentFields,
      provider,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** 浏览器/工具直接打开这个地址时，返回接口用法说明（不执行任何处理） */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/comparison/api",
    method: "POST",
    description:
      "比对 SI 和 BL 的抽取字段，返回 OK/MISMATCH/NEEDS_REVIEW 与不一致的字段列表。不传 provider 时逐字符精确比较（不调用模型）",
    body: {
      si: "从 extraction 拿到的 SI 字段对象（7 个字段，值都是字符串）",
      bl: "从 extraction 拿到的 BL 字段对象",
      provider: "可选：claude | openai | deepseek | gemini | lmstudio | jev；选 jev 可容忍格式差异",
    },
    example: {
      si: { shipper: "ACME SHIPPING CO., LTD." },
      bl: { shipper: "ACME SHIPPING CO.,LTD" },
      provider: "jev",
    },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
