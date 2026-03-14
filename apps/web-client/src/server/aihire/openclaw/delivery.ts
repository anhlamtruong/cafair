export interface OpenClawDeliveryResult {
  delivered: boolean;
  deliveryError?: string;
}

export async function postOpenClawWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<OpenClawDeliveryResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        delivered: false,
        deliveryError: `Webhook returned ${response.status}`,
      };
    }

    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      deliveryError:
        error instanceof Error ? error.message : "Unknown webhook error",
    };
  }
}
