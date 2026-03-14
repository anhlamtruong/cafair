import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { listOpenClawSkills } from "@/server/aihire/openclaw/skills";
import { runOpenClawWorkflow } from "@/server/aihire/openclaw/workflow-runner";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/openclaw/workflows",
    supportedSkills: listOpenClawSkills(),
    purpose: "Run sequential OpenClaw-style workflows over the AI Hire AI agents.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runOpenClawWorkflow(body);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid OpenClaw workflow request",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run OpenClaw workflow",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
