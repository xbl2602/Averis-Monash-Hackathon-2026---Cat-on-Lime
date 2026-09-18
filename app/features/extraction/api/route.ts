import { NextRequest, NextResponse } from "next/server";
import { extractFields } from "../logic";
import { readSampleAttachmentText } from "@/lib/shared/inbox";

// POST { "attachment_path": "attachments/email_004_SI.txt", "documentType": "SI" }
export async function POST(req: NextRequest) {
  let body: { attachment_path?: string; documentType?: "SI" | "BL" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.attachment_path || !body.documentType) {
    return NextResponse.json(
      { error: "需要 attachment_path 和 documentType 两个参数" },
      { status: 400 }
    );
  }

  try {
    const documentText = await readSampleAttachmentText(body.attachment_path);
    const result = await extractFields({
      documentText,
      documentType: body.documentType,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[extraction/api] 抽取失败", err);
    return NextResponse.json(
      { error: `读取附件 ${body.attachment_path} 或抽取过程出错` },
      { status: 500 }
    );
  }
}
