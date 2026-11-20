import { headers } from "next/headers";

export function appUrlFromEnv(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Public base URL, derived from the incoming request when available. */
export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* outside a request */
  }
  return appUrlFromEnv();
}

export const platformMailerConfigured = () => !!(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM);
export const authEmailVerificationRequired = () =>
  platformMailerConfigured() && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
export const whatsappApiConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME);
