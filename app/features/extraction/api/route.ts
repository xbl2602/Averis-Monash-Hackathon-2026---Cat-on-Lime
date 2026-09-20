import { NextRequest, NextResponse } from "next/server";
import { isLLMProvider, isTextProvider } from "@/lib/llm";
import { readSampleAttachmentParsed } from "@/lib/shared/sample-inputs";
import { toClientError } from "@/lib/shared/request-errors";
import { extractFields } from "../logic";

// POST { "attachment_path": "attachments/email_004_SI.txt", "documentType": "SI", "provider": "gemini"(可选) }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 单文档请求最多 1 次外部调用（20s 超时）+ 本地解析，30s 足够且能更快暴露问题
export const maxDuration = 30;

const PROVIDER_HINT = "claude | openai | deepseek | gemini | lmstudio（不支持 jev）";

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
  const body = raw as { attachment_path?: unknown; documentType?: unknown; provider?: unknown };

  if (typeof body.attachment_path !== "string" || body.attachment_path.trim() === "") {
    return NextResponse.json(
      { error: "需要 attachment_path 参数（样例数据里的附件相对路径，非空字符串）" },
      { status: 400 }
    );
  }
  if (body.documentType !== "SI" && body.documentType !== "BL") {
    return NextResponse.json(
      { error: 'documentType 必须是 "SI" 或 "BL"' },
      { status: 400 }
    );
  }

  // provider 的 null / "" 视为未传（与 pipeline 参数校验同口径）；显式传值必须是文本模型
  const rawProvider = body.provider;
  const provider =
    rawProvider === undefined || rawProvider === null || rawProvider === "" ? undefined : rawProvider;
  if (provider !== undefined) {
    if (!isLLMProvider(provider)) {
      return NextResponse.json(
        { error: `不支持的 provider：${String(provider)}（可选 ${PROVIDER_HINT}）` },
        { status: 400 }
      );
    }
    if (!isTextProvider(provider)) {
      return NextResponse.json(
        {
          error:
            "jev 只能做结构化判断（分类/比对），不能做文本抽取，请换 gemini 等文本模型",
        },
        { status: 400 }
      );
    }
  }

  try {
    const parsed = await readSampleAttachmentParsed(body.attachment_path);
    if (parsed.status !== "ok") {
      // 解析器原文只进服务端日志，不回传给调用方（错误文案可读但不透传上游/内部原文）
      console.warn(
        `[extraction] 附件 ${body.attachment_path} 解析失败（原始信息只进服务端日志）：${parsed.error ?? "未知原因"}`
      );
      return NextResponse.json(
        { error: `附件 ${body.attachment_path} 读不出文字（可能是扫描件或损坏文件），无法抽取字段` },
        { status: 422 }
      );
    }
    const result = await extractFields({
      documentText: parsed.text,
      documentType: body.documentType,
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
    endpoint: "/features/extraction/api",
    method: "POST",
    description:
      "从一份 SI/BL 文档里抽取 7 个字段（shipper/consignee/notify_party/port_of_loading/port_of_discharge/container_count/gross_weight_kg）；规则优先，缺字段才调文本 LLM 兜底",
    body: {
      attachment_path: '样例数据里的附件相对路径，例如 "attachments/email_004_SI.txt"',
      documentType: '必填："SI" 或 "BL"',
      provider: `可选文本兜底模型，缺省 gemini；${PROVIDER_HINT}`,
    },
    example: { attachment_path: "attachments/email_004_SI.txt", documentType: "SI" },
  });
}
