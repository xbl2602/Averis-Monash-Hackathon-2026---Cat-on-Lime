import { NextRequest, NextResponse } from "next/server";
import { compareDocuments } from "../logic";
import type { ExtractedDocumentFields } from "@/lib/shared/types";
import { isLLMProvider } from "@/lib/llm";

// POST { "si": {...}, "bl": {...}, "provider": "jev" } -> ComparisonResult
// provider 可省略，默认 claude（逐字符精确比较，不调用模型）
export async function POST(req: NextRequest) {
  let body: {
    si?: ExtractedDocumentFields;
    bl?: ExtractedDocumentFields;
    provider?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.si || !body.bl) {
    return NextResponse.json({ error: "需要 si 和 bl 两个字段对象" }, { status: 400 });
  }

  if (body.provider !== undefined && !isLLMProvider(body.provider)) {
    return NextResponse.json(
      { error: `不支持的 provider：${String(body.provider)}` },
      { status: 400 }
    );
  }

  try {
    const result = await compareDocuments({
      si: body.si,
      bl: body.bl,
      provider: body.provider,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[comparison/api] 比对失败", err);
    return NextResponse.json({ error: "比对过程出错" }, { status: 500 });
  }
}
