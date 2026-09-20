/**
 * GET  /features/config/api  读配置（读开放，敏感项只回掩码）
 * PUT  /features/config/api  批量写配置（需要 x-admin-token）
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  isConfigStoreAvailable,
  listConfigViews,
  upsertConfig,
  type ConfigCategory,
  type ConfigUpdate,
} from "@/lib/shared/config-store";

const CATEGORIES: ConfigCategory[] = ["llm", "pipeline", "storage", "mail", "general"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isConfigStoreAvailable()) {
    return NextResponse.json(
      { error: "配置存储不可用：需要在服务端配置 Supabase（见 .env.example）" },
      { status: 503 }
    );
  }
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("category");
    if (raw && !CATEGORIES.includes(raw as ConfigCategory)) {
      return NextResponse.json(
        { error: `category 不合法，可选：${CATEGORIES.join(" / ")}` },
        { status: 400 }
      );
    }
    const items = await listConfigViews(raw ? (raw as ConfigCategory) : undefined);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (!isConfigStoreAvailable()) {
    return NextResponse.json({ error: "配置存储不可用（缺 Supabase 配置）" }, { status: 503 });
  }
  try {
    const body = await parseJson(request);
    const updates = normalizeUpdates(body);
    const result = await upsertConfig(updates);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("请求体必须是 JSON 对象");
    return body as Record<string, unknown>;
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

function normalizeUpdates(body: Record<string, unknown>): ConfigUpdate[] {
  const raw = body.updates;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("请求体缺少 updates 数组（形如 [{ key, value }]）");
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`updates[${index}] 不是对象`);
    const { key, value } = entry as { key?: unknown; value?: unknown };
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(`updates[${index}].key 必须是非空字符串`);
    }
    if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" && !Array.isArray(value)) {
      throw new Error(`updates[${index}].value 只支持 string / number / boolean / string[] / null`);
    }
    return { key: key.trim(), value: value as ConfigUpdate["value"] };
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
