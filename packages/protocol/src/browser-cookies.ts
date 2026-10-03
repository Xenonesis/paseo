export type SupportedLocalBrowser = "chrome" | "edge" | "brave";

export interface LocalBrowserCookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expires?: number;
}

export interface ImportBrowserCookiesRequest {
  browser: SupportedLocalBrowser;
  url: string;
}

export interface ImportBrowserCookiesResponse {
  ok: boolean;
  importedCount: number;
  browser: SupportedLocalBrowser;
  domain: string;
  error?: string;
}
