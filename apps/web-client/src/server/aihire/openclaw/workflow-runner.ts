import { z } from "zod";
import {
  OPENCLAW_WEBHOOK_FORMATS,
  resolveOpenClawNotificationTarget,
  type OpenClawNotificationTarget,
} from "./contracts";
import { postOpenClawWebhook } from "./delivery";
import {
  addOpenClawNotification,
} from "./notification-outbox";
import {
  OPENCLAW_SKILL_NAMES,
  runOpenClawSkill,
} from "./skills";

const notificationTargetSchema = z.object({
  webhookUrl: z.string().url().optional(),
  webhookFormat: z.enum(OPENCLAW_WEBHOOK_FORMATS).optional(),
  channelId: z.string().optional(),
  conversationId: z.string().optional(),
  actorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const workflowStepSchema = z.object({
  stepId: z.string().optional(),
  skill: z.enum(OPENCLAW_SKILL_NAMES),
  input: z.unknown(),
});

const workflowRequestSchema = z.object({
  workflowId: z.string().optional(),
  stopOnError: z.boolean().optional().default(true),
  channelId: z.string().optional(),
  conversationId: z.string().optional(),
  notify: notificationTargetSchema.optional(),
  steps: z.array(workflowStepSchema).min(1),
});

export interface OpenClawWorkflowStepResult {
  stepId: string;
  skill: (typeof OPENCLAW_SKILL_NAMES)[number];
  status: "completed" | "failed" | "skipped";
  result?: unknown;
  error?: string;
}

export interface OpenClawWorkflowResult {
  ok: boolean;
  workflowId: string;
  stopOnError: boolean;
  completedSteps: number;
  failedSteps: number;
  summaryText: string;
  steps: OpenClawWorkflowStepResult[];
}

function makeWorkflowId(): string {
  return `ocw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildWorkflowSummaryText(result: {
  ok: boolean;
  workflowId: string;
  completedSteps: number;
  failedSteps: number;
  steps: OpenClawWorkflowStepResult[];
}): string {
  const totalSteps = result.steps.length;
  const failedStep = result.steps.find((step) => step.status === "failed");

  if (result.ok) {
    const lastStep = result.steps[result.steps.length - 1];
    const lastStepText = lastStep ? ` Last step: ${lastStep.skill}.` : "";

    return (
      `Workflow ${result.workflowId} completed successfully. ` +
      `${result.completedSteps}/${totalSteps} steps finished.` +
      lastStepText
    ).trim();
  }

  const failureText = failedStep
    ? ` Failed at ${failedStep.stepId} (${failedStep.skill}).`
    : "";

  return (
    `Workflow ${result.workflowId} failed. ` +
    `${result.completedSteps}/${totalSteps} steps completed, ` +
    `${result.failedSteps} failed.` +
    failureText
  ).trim();
}

function buildWorkflowNotificationPayload(args: {
  type: "workflow.completed" | "workflow.failed";
  result: OpenClawWorkflowResult;
  target?: OpenClawNotificationTarget;
}) {
  return {
    type: args.type,
    workflowId: args.result.workflowId,
    channelId: args.target?.channelId,
    conversationId: args.target?.conversationId,
    actorId: args.target?.actorId,
    metadata: args.target?.metadata ?? {},
    text: args.result.summaryText,
    result: args.result,
  };
}

export async function runOpenClawWorkflow(rawInput: unknown) {
  const input = workflowRequestSchema.parse(rawInput);
  const workflowId = input.workflowId ?? makeWorkflowId();
  const steps: OpenClawWorkflowStepResult[] = [];

  for (const [index, step] of input.steps.entries()) {
    const stepId = step.stepId ?? `step_${index + 1}`;

    try {
      const skillRun = await runOpenClawSkill({
        skill: step.skill,
        input: step.input,
      });

      steps.push({
        stepId,
        skill: step.skill,
        status: "completed",
        result: skillRun.result,
      });
    } catch (error) {
      steps.push({
        stepId,
        skill: step.skill,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown workflow error",
      });

      if (input.stopOnError) {
        break;
      }
    }
  }

  const completedSteps = steps.filter((step) => step.status === "completed").length;
  const failedSteps = steps.filter((step) => step.status === "failed").length;
  const result: OpenClawWorkflowResult = {
    ok: failedSteps === 0,
    workflowId,
    stopOnError: input.stopOnError,
    completedSteps,
    failedSteps,
    summaryText: "",
    steps,
  };

  result.summaryText = buildWorkflowSummaryText(result);

  const target = resolveOpenClawNotificationTarget(
    {
      channelId: input.channelId,
      conversationId: input.conversationId,
    },
    input.notify,
  );
  const notificationType = result.ok ? "workflow.completed" : "workflow.failed";
  const notificationPayload = buildWorkflowNotificationPayload({
    type: notificationType,
    result,
    target,
  });
  const delivery = target?.webhookUrl
    ? await postOpenClawWebhook(target, notificationPayload)
    : { delivered: false as const };

  addOpenClawNotification({
    type: notificationType,
    text: result.summaryText,
    workflowId,
    channelId: target?.channelId,
    conversationId: target?.conversationId,
    delivery: {
      webhookUrl: target?.webhookUrl,
      webhookFormat: delivery.webhookFormat,
      delivered: delivery.delivered,
      deliveryError: delivery.deliveryError,
    },
    payload: notificationPayload,
  });

  return result;
}
