export type WebFetch = (url: string) => Promise<{ text: () => Promise<string> }>;
