import { z } from "zod";
import { isYmd } from "@/lib/dates";
import { CURRENCIES } from "@/lib/money";

export const decimal = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^-?\d{1,14}(\.\d{1,6})?$/.test(v), "Must be a valid number");

export const positiveDecimal = decimal.refine((v) => Number(v) > 0, "Must be greater than zero");
export const nonNegDecimal = decimal.refine((v) => Number(v) >= 0, "Must not be negative");

export const ymd = z.string().refine(isYmd, "Use a valid date (YYYY-MM-DD)");
export const uuid = z.string().uuid("Invalid id");
export const currencyCode = z
  .string()
  .length(3)
  .transform((s) => s.toUpperCase())
  .refine((s) => (CURRENCIES as readonly string[]).includes(s) || /^[A-Z]{3}$/.test(s), "Invalid currency");

const optText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));

export const LANGUAGES = ["en", "ur", "roman_ur"] as const;
export const CHANNELS = ["email", "whatsapp"] as const;

export const clientInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  businessName: optText(160),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address"),
  phone: optText(40),
  country: optText(80),
  billingAddress: optText(500),
  taxId: optText(60),
  language: z.enum(LANGUAGES).default("en"),
  preferredChannel: z.enum(CHANNELS).default("email"),
  whatsappConsent: z.boolean().optional(),
  remindersPaused: z.boolean().optional(),
});
export type ClientInput = z.infer<typeof clientInput>;

export const itemInput = z.object({
  description: z.string().trim().min(1, "Item description is required").max(500),
  quantity: positiveDecimal,
  unitPrice: nonNegDecimal,
});

export const invoiceInput = z
  .object({
    clientId: uuid,
    title: optText(200),
    number: optText(40),
    currency: currencyCode,
    issueDate: ymd,
    dueDate: ymd,
    items: z.array(itemInput).min(1, "Add at least one line item").max(100),
    discountType: z.enum(["none", "percent", "fixed"]).default("none"),
    discountValue: nonNegDecimal.default("0"),
    taxRate: nonNegDecimal.refine((v) => Number(v) <= 100, "Tax rate cannot exceed 100%").default("0"),
    paymentTerms: optText(1000),
    notes: optText(2000),
    internalNotes: optText(2000),
    status: z.enum(["draft", "sent"]).default("draft"),
  })
  .refine((v) => v.dueDate >= v.issueDate, { message: "Due date cannot be before the issue date", path: ["dueDate"] });
export type InvoiceInput = z.infer<typeof invoiceInput>;

export const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "paypal", "stripe", "wise", "jazzcash", "easypaisa", "other"] as const;
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  paypal: "PayPal",
  stripe: "Stripe",
  wise: "Wise",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  other: "Other",
};

export const paymentInput = z.object({
  invoiceId: uuid,
  amount: positiveDecimal,
  paidAt: ymd,
  method: z.string().trim().min(1).max(60),
  reference: optText(120),
  notes: optText(1000),
  correctsPaymentId: uuid.optional(),
});

export const reverseInput = z.object({ reason: z.string().trim().min(3, "Please give a reason").max(500) });

export const ruleInput = z.object({
  name: z.string().trim().min(1).max(100),
  offsetDays: z.number().int().min(-60).max(180),
  channel: z.enum(CHANNELS),
  language: z.enum(["client", ...LANGUAGES]),
  templateKey: z.enum(["upcoming", "due_today", "first_overdue", "follow_up", "final"]),
  enabled: z.boolean().default(true),
});

export const settingsInput = z.object({
  businessName: z.string().trim().min(1).max(160),
  email: optText(254),
  phone: optText(40),
  address: optText(500),
  country: optText(80),
  taxId: optText(60),
  website: optText(200),
  logoDataUrl: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG or JPEG image")
    .nullable()
    .optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #236B57"),
  invoiceFooter: optText(500),
  paymentInstructions: optText(1500),
  defaultCurrency: currencyCode,
  numberFormat: z.string().trim().min(3).max(40),
  paymentTermsDays: z.number().int().min(0).max(365),
  defaultTaxRate: nonNegDecimal.refine((v) => Number(v) <= 100),
  defaultTerms: optText(1000),
  timezone: z.string().min(1).max(60),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  reminderSendHour: z.number().int().min(0).max(23),
  paymentMethods: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

export const importRow = z.object({
  number: z.string().trim().min(1).max(40),
  clientName: z.string().trim().min(1).max(160),
  clientEmail: optText(254),
  issueDate: ymd,
  dueDate: ymd,
  currency: currencyCode,
  total: positiveDecimal,
  paid: nonNegDecimal.default("0"),
  description: optText(500),
});
export type ImportRow = z.infer<typeof importRow>;

export const loginInput = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
export const signupInput = z.object({
  name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  businessName: z.string().trim().min(1, "Business name is required").max(160),
  timezone: z.string().max(60).optional(),
});
