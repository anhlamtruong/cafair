import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  listOpenClawSkills,
  openClawSkillRequestSchema,
  runOpenClawSkill,
} from "@/server/aihire/openclaw/skills";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/aihire/openclaw/skills",
    skills: listOpenClawSkills(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = openClawSkillRequestSchema.parse(body);
    const result = await runOpenClawSkill(parsed);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid OpenClaw skill request",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run OpenClaw skill",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
