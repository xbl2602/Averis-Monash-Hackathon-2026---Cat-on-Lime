/**
 * GET  /features/config/api  Read config (open read access; sensitive items are returned masked)
 * PUT  /features/config/api  Batch-write config (requires x-admin-token)
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  ConfigConflictError,
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
      { error: "Config store unavailable: Supabase must be configured on the server (see .env.example)" },
      { status: 503 }
    );
  }
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("category");
    if (raw && !CATEGORIES.includes(raw as ConfigCategory)) {
      return NextResponse.json(
        { error: `Invalid category, must be one of: ${CATEGORIES.join(" / ")}` },
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
    return NextResponse.json({ error: "Config store unavailable (missing Supabase configuration)" }, { status: 503 });
  }
  try {
    const body = await parseJson(request);
    const updates = normalizeUpdates(body);
    const result = await upsertConfig(updates);
    return NextResponse.json(result);
  } catch (err) {
    // Optimistic-lock conflict: the whole batch was not written; tell the caller to re-read then save again
    if (err instanceof ConfigConflictError) {
      return NextResponse.json({ error: err.message, conflicts: err.keys }, { status: 409 });
    }
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object");
    return body as Record<string, unknown>;
  } catch {
    throw new Error("Request body is not valid JSON");
  }
}

function normalizeUpdates(body: Record<string, unknown>): ConfigUpdate[] {
  const raw = body.updates;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Request body is missing the updates array (shaped like [{ key, value }])");
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`updates[${index}] is not an object`);
    const { key, value, expected_updated_at } = entry as {
      key?: unknown;
      value?: unknown;
      expected_updated_at?: unknown;
    };
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error(`updates[${index}].key must be a non-empty string`);
    }
    if (value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" && !Array.isArray(value)) {
      throw new Error(`updates[${index}].value only supports string / number / boolean / string[] / null`);
    }
    // null is treated as "no optimistic lock": GET returns updated_at: null for items with no database row,
    // so the GUI echoing the item back as-is shouldn't cause a 400 because of that; only genuinely invalid values are rejected
    const hasExpected = expected_updated_at !== undefined && expected_updated_at !== null;
    if (hasExpected && (typeof expected_updated_at !== "string" || Number.isNaN(new Date(expected_updated_at).getTime()))) {
      throw new Error(`updates[${index}].expected_updated_at must be a valid ISO date string (from the updated_at of a previous GET)`);
    }
    return {
      key: key.trim(),
      value: value as ConfigUpdate["value"],
      ...(hasExpected ? { expected_updated_at: expected_updated_at as string } : {}),
    };
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
