export const DIALOGUE_LANGUAGES = [
  "en", "zh", "hi", "es", "fr", "ar", "bn", "pt", "ru", "id",
] as const;

export type DialogueLanguage = (typeof DIALOGUE_LANGUAGES)[number];

export const DIALOGUE_LANGUAGE_NAMES: Record<DialogueLanguage, string> = {
  en: "English", zh: "Chinese", hi: "Hindi", es: "Spanish", fr: "French",
  ar: "Arabic", bn: "Bengali", pt: "Portuguese", ru: "Russian", id: "Indonesian",
};

const INTERNAL_MESSAGE_PREFIXES = [
  "An integrated-terminal command started from the Run button has finished.",
];
const INJECTED_MARKERS = [
  "\n\n# Integrated terminal execution memory",
  "\n\n# Configured integrated terminal",
];

function userAuthoredPart(value: string): string {
  const trimmed = value.trim();
  if (INTERNAL_MESSAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return "";
  let end = value.length;
  for (const marker of INJECTED_MARKERS) {
    const index = value.indexOf(marker);
    if (index >= 0) end = Math.min(end, index);
  }
  return value.slice(0, end).trim();
}

const LATIN_HINTS: Record<"en" | "es" | "fr" | "pt" | "id", ReadonlySet<string>> = {
  en: new Set(["the", "this", "that", "with", "for", "from", "and", "please", "make", "fix", "find", "look", "show", "create", "update", "remove", "why", "how", "what", "it"]),
  es: new Set(["el", "la", "los", "las", "un", "una", "que", "para", "por", "con", "esto", "esta", "este", "quiero", "haz", "hacer", "busca", "mira", "corrige", "archivo", "como", "pero", "del"]),
  fr: new Set(["le", "la", "les", "des", "un", "une", "que", "pour", "avec", "ce", "cette", "ceci", "cela", "je", "vous", "veux", "fait", "faire", "cherche", "regarde", "corrige", "fichier", "comment", "mais", "dans"]),
  pt: new Set(["o", "a", "os", "as", "um", "uma", "que", "para", "por", "com", "isso", "isto", "este", "quero", "faz", "faça", "fazer", "procure", "veja", "corrija", "arquivo", "como", "não", "você"]),
  id: new Set(["yang", "dan", "untuk", "dengan", "ini", "itu", "saya", "buat", "cari", "lihat", "perbaiki", "tidak", "dari", "bagaimana", "tolong", "pada", "ke", "di"]),
};

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function detectTextLanguage(value: string): DialogueLanguage | null {
  const text = userAuthoredPart(value);
  if (!text) return null;
  const scriptWinner = [
    ["ru", countMatches(text, /\p{Script=Cyrillic}/gu)],
    ["zh", countMatches(text, /\p{Script=Han}/gu)],
    ["ar", countMatches(text, /\p{Script=Arabic}/gu)],
    ["bn", countMatches(text, /\p{Script=Bengali}/gu)],
    ["hi", countMatches(text, /\p{Script=Devanagari}/gu)],
  ] as const;
  const strongestScript = [...scriptWinner].sort((a, b) => b[1] - a[1])[0];
  if (strongestScript[1] >= 2) return strongestScript[0];

  const tokens = text.toLocaleLowerCase().match(/\p{Script=Latin}+/gu) ?? [];
  if (tokens.length === 0) return null;
  const scores = new Map<"en" | "es" | "fr" | "pt" | "id", number>();
  for (const [language, hints] of Object.entries(LATIN_HINTS) as Array<["en" | "es" | "fr" | "pt" | "id", ReadonlySet<string>]>) {
    scores.set(language, tokens.reduce((score, token) => score + (hints.has(token) ? 1 : 0), 0));
  }
  if (/[ñ¿¡]/iu.test(text)) scores.set("es", (scores.get("es") ?? 0) + 3);
  if (/[àâæçéèêëîïôœùûüÿ]/iu.test(text)) scores.set("fr", (scores.get("fr") ?? 0) + 3);
  if (/[ãõ]/iu.test(text) || /\b(?:não|você|faça)\b/iu.test(text)) scores.set("pt", (scores.get("pt") ?? 0) + 3);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1]) return ranked[0][0];
  if (tokens.length >= 3) return "en";
  return null;
}

/** Detects the latest confidently authored dialogue language, newest first. */
export function detectDialogueLanguage(
  userMessages: readonly string[],
  fallback: DialogueLanguage = "en",
): DialogueLanguage {
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const detected = detectTextLanguage(userMessages[index]);
    if (detected) return detected;
  }
  return fallback;
}
