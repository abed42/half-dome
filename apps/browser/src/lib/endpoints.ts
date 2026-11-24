export type ServiceName = "logs" | "feedback" | "switches";

export let LOGS_URL = "";
export let FEEDBACK_URL = "";
export let SWITCHES_URL = "";

const urlOf = (name: ServiceName): string => {
  const raw = name === "logs" ? LOGS_URL : name === "feedback" ? FEEDBACK_URL : SWITCHES_URL;
  return raw.trim();
};

export const serviceUrl = (name: ServiceName): string => urlOf(name);

export function serviceReady(name: ServiceName): boolean {
  const url = urlOf(name);
  if (!url) return false;
  try {
    const scheme = new URL(url).protocol.toLowerCase();
    return scheme === "https:" || scheme === "http:";
  } catch {
    return false;
  }
}

export const logsUrl = (): string => urlOf("logs");
export const feedbackUrl = (): string => urlOf("feedback");
export const switchesUrl = (): string => urlOf("switches");

export const logsReady = (): boolean => serviceReady("logs");
export const feedbackReady = (): boolean => serviceReady("feedback");
export const switchesReady = (): boolean => serviceReady("switches");

export function setServiceEndpointsForTests(next: Partial<Record<ServiceName, string>>) {
  if (next.logs !== undefined) LOGS_URL = next.logs;
  if (next.feedback !== undefined) FEEDBACK_URL = next.feedback;
  if (next.switches !== undefined) SWITCHES_URL = next.switches;
}

export function resetServiceEndpointsForTests() {
  LOGS_URL = "";
  FEEDBACK_URL = "";
  SWITCHES_URL = "";
}

export function isArdiaServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "ardia.dev" || host.endsWith(".ardia.dev")) return true;
    if ((host === "github.com" || host === "api.github.com") && parsed.pathname.toLowerCase().includes("/ardia-browser/")) return true;
    return false;
  } catch {
    return /ardia\.dev|ardia-browser/i.test(url);
  }
}
