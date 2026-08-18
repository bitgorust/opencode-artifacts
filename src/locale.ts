import type { Frontmatter } from "./markdown.ts";

export type TextDirection = "ltr" | "rtl";

export interface LocaleContext {
  lang: string;
  dir: TextDirection;
  locale: string;
  timeZone: string;
}

const RTL_LANGUAGES = new Set(["ar", "ckb", "dv", "fa", "he", "ku", "ps", "sd", "ug", "ur", "yi"]);

export function canonicalLocale(value: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

export function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function resolveLocaleContext(meta: Frontmatter): LocaleContext {
  const locale = canonicalLocale(meta.locale ?? meta.lang ?? "en-US") ?? "en-US";
  const lang = canonicalLocale(meta.lang ?? meta.locale ?? "en") ?? "en";
  const language = new Intl.Locale(lang).language;
  const dir = meta.dir === "ltr" || meta.dir === "rtl"
    ? meta.dir
    : RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  return {
    lang,
    dir,
    locale,
    timeZone: meta.timezone !== undefined && validTimeZone(meta.timezone) ? meta.timezone : "UTC",
  };
}

export function isZonedIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function formatZonedTimestamp(value: string, context: LocaleContext, includeTime: boolean): string | undefined {
  if (!isZonedIsoTimestamp(value)) return undefined;
  return new Intl.DateTimeFormat(context.locale, {
    timeZone: context.timeZone,
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}
