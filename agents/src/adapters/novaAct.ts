// Use this to power:
// - Candidate-side "Agent Plan" runs
// - Recruiter-side "ATS Sync" runs

export type NovaActMode = "stub" | "real";

export interface NovaActConfig {
  mode: NovaActMode;
  region?: string;                 
  workflowDefinitionArn?: string;   // Nova Act workflow-definition ARN
}

export type RunStatus = "Queued" | "Running" | "Success" | "Failed";

export interface ActStep {
  step: string;        // short label
  details?: string;    // brief description
  status: RunStatus;
}

export interface ActRun {
  runId: string;
  workflowDefinitionArn?: string;
  status: RunStatus;
  steps: ActStep[];
  startedAtISO: string;
  finishedAtISO?: string;
  errorMessage?: string;
  output?: Record<string, any>;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function novaActStartRun(args: {
  cfg: NovaActConfig;
  input: Record<string, any>;
  stepsPreview: Omit<ActStep, "status">[]; 
}): Promise<ActRun> {
  const { cfg, input, stepsPreview } = args;

  if (cfg.mode === "stub") {
    const runId = uid("actrun");
    const steps: ActStep[] = stepsPreview.map((s, i) => ({
      ...s,
      status: i === 0 ? "Running" : "Queued",
    }));

    for (let i = 0; i < steps.length; i++) {
      steps[i].status = "Running";
      await sleep(250); 
      steps[i].status = "Success";
      if (i + 1 < steps.length) steps[i + 1].status = "Running";
    }

    return {
      runId,
      workflowDefinitionArn: cfg.workflowDefinitionArn,
      status: "Success",
      steps,
      startedAtISO: new Date().toISOString(),
      finishedAtISO: new Date().toISOString(),
      output: {
        message: "Stub Nova Act run completed.",
        echoedInputKeys: Object.keys(input),
      },
    };
  }

 
  // Outline:
  // 1) validate cfg.workflowDefinitionArn
  // 2) call start execution API with `input`
  // 3) return runId + initial status
  throw new Error("novaActStartRun real mode not implemented yet.");
}

export async function novaActGetRun(args: {
  cfg: NovaActConfig;
  runId: string;
}): Promise<ActRun> {
  if (args.cfg.mode === "stub") {
    return {
      runId: args.runId,
      workflowDefinitionArn: args.cfg.workflowDefinitionArn,
      status: "Success",
      steps: [{ step: "Stub status", details: "This is a stub run lookup", status: "Success" }],
      startedAtISO: new Date().toISOString(),
      finishedAtISO: new Date().toISOString(),
    };
  }

  throw new Error("novaActGetRun real mode not implemented yet.");
}