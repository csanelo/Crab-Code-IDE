export const REASONING_EFFORT_LEVELS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORT_LEVELS)[number];

const STORAGE_KEY = "crabcode.agent.reasoning-effort";
const DEFAULT_EFFORT: ReasoningEffort = "medium";
type ReasoningEffortListener = (value: ReasoningEffort) => void;
const listeners = new Set<ReasoningEffortListener>();

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_EFFORT_LEVELS as readonly string[]).includes(value);
}

export function getReasoningEffort(): ReasoningEffort {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.toLowerCase() ?? "";
    return isReasoningEffort(stored) ? stored : DEFAULT_EFFORT;
  } catch {
    return DEFAULT_EFFORT;
  }
}

function publish(value: ReasoningEffort): void {
  for (const listener of listeners) listener(value);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const value = event.newValue.toLowerCase();
    if (isReasoningEffort(value)) publish(value);
  });
  window.addEventListener("focus", () => publish(getReasoningEffort()));
}

export function setReasoningEffort(value: ReasoningEffort): void {
  window.localStorage.setItem(STORAGE_KEY, value);
  publish(value);
}

export function subscribeReasoningEffort(
  listener: ReasoningEffortListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
