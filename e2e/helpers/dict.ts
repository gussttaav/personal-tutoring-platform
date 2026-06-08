import es from "../../messages/es.json";
import en from "../../messages/en.json";

export const dict = { es, en } as const;
export type Locale = keyof typeof dict;
export const LOCALES: Locale[] = ["es", "en"];
