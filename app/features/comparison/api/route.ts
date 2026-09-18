import { NextRequest, NextResponse } from "next/server";
import { compareDocuments } from "../logic";
import type { ExtractedDocumentFields } from "@/lib/shared/types";

// POST { "si": {...}, "bl": {...} } -> ComparisonResult
export async function POST(req: NextRequest) {
  let body: { si?: ExtractedDocumentFields; bl?: ExtractedDocumentFields };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.si || !body.bl) {
    return NextResponse.json({ error: "需要 si 和 bl 两个字段对象" }, { status: 400 });
  }

  try {
    const result = await compareDocuments({ si: body.si, bl: body.bl });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[comparison/api] 比对失败", err);
    return NextResponse.json({ error: "比对过程出错" }, { status: 500 });
  }
}
