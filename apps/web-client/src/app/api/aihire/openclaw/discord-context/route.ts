import { NextResponse } from "next/server";
import { buildOpenClawDiscordContext } from "@/server/aihire/openclaw/discord-context";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const configuredSecret = process.env.OPENCLAW_DISCORD_SHARED_SECRET?.trim();

  if (!configuredSecret) {
    return true;
  }

  return req.headers.get("x-openclaw-discord-secret") === configuredSecret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized Discord context request." },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as {
      message?: string;
      transcript?: string;
      guildId?: string;
      channelId?: string;
    };

    const context = await buildOpenClawDiscordContext({
      message: typeof body.message === "string" ? body.message : "",
      transcript: typeof body.transcript === "string" ? body.transcript : "",
      guildId: typeof body.guildId === "string" ? body.guildId : undefined,
      channelId: typeof body.channelId === "string" ? body.channelId : undefined,
    });

    return NextResponse.json({
      ok: true,
      ...context,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to build Discord workspace context.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
