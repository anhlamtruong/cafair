export type ApplyAgentHistoryItem = {
  id: string;
  createdAt: string;
  mode: "match" | "run";
  status: "queued" | "running" | "completed" | "failed";
  summary: string;
  targetUrl?: string;
  company?: string;
  roleTitle?: string;
  matchedKeywordCount?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __aihireApplyAgentHistoryStore:
    | ApplyAgentHistoryItem[]
    | undefined;
}

const historyStore: ApplyAgentHistoryItem[] =
  globalThis.__aihireApplyAgentHistoryStore ?? [];

if (!globalThis.__aihireApplyAgentHistoryStore) {
  globalThis.__aihireApplyAgentHistoryStore = historyStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeHistoryId(): string {
  return `aah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getApplyAgentHistory(): ApplyAgentHistoryItem[] {
  return [...historyStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function addApplyAgentHistoryItem(
  item: Omit<ApplyAgentHistoryItem, "id" | "createdAt">,
): ApplyAgentHistoryItem {
  const nextItem: ApplyAgentHistoryItem = {
    id: makeHistoryId(),
    createdAt: nowIso(),
    ...item,
  };

  historyStore.unshift(nextItem);
  return nextItem;
}

export function updateApplyAgentHistoryItem(
  id: string,
  updates: Partial<Omit<ApplyAgentHistoryItem, "id" | "createdAt">>,
): ApplyAgentHistoryItem | null {
  const index = historyStore.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  historyStore[index] = {
    ...historyStore[index],
    ...updates,
  };

  return historyStore[index];
}
