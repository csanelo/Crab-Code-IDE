export const CONTEXT_CATEGORY_IDS = [
  "systemPrompt",
  "toolDefinitions",
  "projectRules",
  "skills",
  "memory",
  "conversation",
  "toolResults",
] as const;

export type ContextCategoryId = (typeof CONTEXT_CATEGORY_IDS)[number];
export type ContextCharBreakdown = Record<ContextCategoryId, number>;

export interface ContextUsageCategory {
  id: ContextCategoryId;
  tokens: number;
}

export interface ContextUsageSnapshot {
  model: string;
  contextWindow: number;
  inputTokens: number;
  outputTokens: number;
  totalInputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  measured: boolean;
  spendingMeasured: boolean;
  categories: ContextUsageCategory[];
  updatedAt: number;
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

function validReportedContextWindow(value?: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(value as number);
  return rounded >= 4_096 && rounded <= 20_000_000 ? rounded : undefined;
}

export function contextWindowForModel(
  model: string,
  providerReportedContextWindow?: number,
): number {
  const reported = validReportedContextWindow(providerReportedContextWindow);
  if (reported) return reported;

  const id = model.toLowerCase().trim();

  // ponytail: Dynamically detect context window size from model ID suffixes (e.g. 32k, 128k, 1m) or token counts.
  const explicitK = id.match(/(?:^|[\/_:.-])(\d{1,4})k(?:$|[\/_:.-])/);
  if (explicitK) return Number(explicitK[1]) * 1_024;
  const explicitM = id.match(/(?:^|[\/_:.-])(\d{1,2})m(?:$|[\/_:.-])/);
  if (explicitM) return Number(explicitM[1]) * 1_000_000;

  const explicitNum = id.match(
    /(?:^|[\/_:.-])(4096|8192|16384|32768|65536|128000|131072|200000|204800|262144|524288|1000000|1048576|2000000|2097152|10000000)(?:$|[\/_:.-])/,
  );
  if (explicitNum) return Number(explicitNum[1]);

  if (/deepseek-v4|nemotron-3-ultra/.test(id)) return 1_000_000;
  if (/ling-3/.test(id)) return 262_144;
  if (/mimo/.test(id)) return 131_072;
  if (/gemini-(?:1\.5|2(?:\.\d+)?|3(?:\.\d+)?)/.test(id)) {
    if (/gemini-(?:1\.5|2(?:\.0)?)-pro/.test(id)) return 2_097_152;
    return 1_048_576;
  }
  if (/claude/.test(id)) return 200_000;
  if (/gpt-4\.1/.test(id)) return 1_047_576;
  if (/gpt-4\.5/.test(id)) return 128_000;
  if (/gpt-5/.test(id)) return 400_000;
  if (/(?:^|[\/_:.-])o(?:1|3|4)(?:$|[\/_:.-])/.test(id)) return 200_000;
  if (/gpt-4o|gpt-4-turbo/.test(id)) return 128_000;
  if (/llama[-_. ]?4.*scout/.test(id)) return 10_000_000;
  if (/llama[-_. ]?4.*maverick/.test(id)) return 1_000_000;
  if (/llama[-_. ]?(?:3|3\.1|3\.2|3\.3)/.test(id)) return 131_072;
  if (/codestral/.test(id)) return 262_144;
  if (/mistral.*(?:large|nemo)|pixtral/.test(id)) return 131_072;
  if (/mistral.*small/.test(id)) return 32_768;
  if (/qwen3/.test(id)) return 262_144;
  if (/qwen|qwq|deepseek|ling|glm[-_. ]?4/.test(id)) return 131_072;
  if (/nemotron/.test(id)) return 262_144;
  if (/minimax[-_. ]?text[-_. ]?01/.test(id)) return 1_000_000;
  if (/grok[-_. ]?4/.test(id)) return 256_000;
  if (/grok|sonar|command[-_. ]?r/.test(id)) return 131_072;
  if (/jamba/.test(id)) return 262_144;
  if (/yi[-_. ]?(?:large|lightning)/.test(id)) return 200_000;

  return 128_000;
}

export function buildContextUsageSnapshot(args: {
  model: string;
  chars: ContextCharBreakdown;
  contextWindow?: number;
  measuredInputTokens?: number;
  outputTokens?: number;
  totalInputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  spendingMeasured?: boolean;
}): ContextUsageSnapshot {
  const raw = CONTEXT_CATEGORY_IDS.map((id) => ({
    id,
    tokens: estimateTokensFromChars(args.chars[id]),
  }));
  const rawTotal = raw.reduce((sum, category) => sum + category.tokens, 0);
  const measured =
    Number.isFinite(args.measuredInputTokens) &&
    (args.measuredInputTokens ?? 0) > 0;
  const inputTokens = measured
    ? Math.max(0, Math.round(args.measuredInputTokens as number))
    : rawTotal;

  let categories = raw;
  if (measured && rawTotal > 0) {
    categories = raw.map((category) => ({
      ...category,
      tokens: Math.floor((category.tokens * inputTokens) / rawTotal),
    }));
    let remainder =
      inputTokens - categories.reduce((sum, category) => sum + category.tokens, 0);
    const order = [...categories]
      .map((category, index) => ({ index, weight: raw[index].tokens }))
      .sort((a, b) => b.weight - a.weight);
    for (let index = 0; remainder > 0 && order.length > 0; index += 1) {
      categories[order[index % order.length].index].tokens += 1;
      remainder -= 1;
    }
  } else if (measured && rawTotal === 0) {
    categories = raw.map((category) => ({
      ...category,
      tokens: category.id === "conversation" ? inputTokens : 0,
    }));
  }

  const outputTokens = Math.max(0, Math.round(args.outputTokens ?? 0));
  const totalInputTokens = Math.max(
    0,
    Math.round(args.totalInputTokens ?? inputTokens),
  );
  const totalTokens = Math.max(
    totalInputTokens + outputTokens,
    Math.round(args.totalTokens ?? totalInputTokens + outputTokens),
  );
  const cachedInputTokens = Math.min(
    totalInputTokens,
    Math.max(0, Math.round(args.cachedInputTokens ?? 0)),
  );

  return {
    model: args.model,
    contextWindow: contextWindowForModel(args.model, args.contextWindow),
    inputTokens,
    outputTokens,
    totalInputTokens,
    totalTokens,
    cachedInputTokens,
    measured,
    spendingMeasured: args.spendingMeasured ?? measured,
    categories,
    updatedAt: Date.now(),
  };
}
