export type ApplyBatchProvider =
  | "greenhouse"
  | "workday"
  | "ashby"
  | "lever"
  | "smartrecruiters"
  | "icims"
  | "taleo"
  | "rippling"
  | "other";

export function detectApplyBatchProvider(targetUrl: string): ApplyBatchProvider {
  try {
    const url = new URL(targetUrl);
    const host = url.hostname.toLowerCase();
    const href = targetUrl.toLowerCase();

    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("ashbyhq.com")) return "ashby";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("smartrecruiters.com")) return "smartrecruiters";
    if (host.includes("icims.com")) return "icims";
    if (host.includes("rippling.com")) return "rippling";
    if (host.includes("myworkdayjobs.com") || href.includes("workday")) return "workday";
    if (host.includes("taleo.net") || host.includes("oraclecloud.com")) return "taleo";

    return "other";
  } catch {
    return "other";
  }
}

export function isAutomationSupportedProvider(
  provider: ApplyBatchProvider,
): provider is "greenhouse" | "workday" | "ashby" {
  return provider === "greenhouse" || provider === "workday" || provider === "ashby";
}
