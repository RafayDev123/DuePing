import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
const createdAt = () => ts("created_at").notNull().defaultNow();

/* ───────────── Identity ───────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // verify_email | reset_password
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash)],
);

/* ───────────── Workspaces ───────────── */

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // owner | admin | accountant | member | viewer
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wm_ws_user_uq").on(t.workspaceId, t.userId), index("wm_user_idx").on(t.userId)],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wi_hash_uq").on(t.tokenHash), index("wi_ws_idx").on(t.workspaceId)],
);

export const businessSettings = pgTable("business_settings", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  country: text("country"),
  taxId: text("tax_id"),
  website: text("website"),
  logoDataUrl: text("logo_data_url"),
  brandColor: text("brand_color").notNull().default("#236B57"),
  invoiceFooter: text("invoice_footer"),
  paymentInstructions: text("payment_instructions"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  numberFormat: text("number_format").notNull().default("DP-{YYYY}-{NNNN}"),
  paymentTermsDays: integer("payment_terms_days").notNull().default(14),
  defaultTaxRate: numeric("default_tax_rate", { precision: 8, scale: 3 }).notNull().default("0"),
  defaultTerms: text("default_terms"),
  timezone: text("timezone").notNull().default("UTC"),
  quietStart: integer("quiet_start").notNull().default(21),
  quietEnd: integer("quiet_end").notNull().default(8),
  reminderSendHour: integer("reminder_send_hour").notNull().default(9),
  autoRemindersEnabled: boolean("auto_reminders_enabled").notNull().default(false),
  templatesReviewedAt: ts("templates_reviewed_at"),
  preferencesConfirmedAt: ts("preferences_confirmed_at"),
  paymentMethods: jsonb("payment_methods").$type<string[]>().notNull().default([]),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const invoiceSequences = pgTable(
  "invoice_sequences",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.year] })],
);

export const subscriptions = pgTable("subscriptions", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: ts("current_period_end"),
  createdAt: createdAt(),
});

/* ───────────── Clients ───────────── */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    businessName: text("business_name"),
    email: text("email"),
    phone: text("phone"),
    country: text("country"),
    billingAddress: text("billing_address"),
    taxId: text("tax_id"),
    language: text("language").notNull().default("en"),
    preferredChannel: text("preferred_channel").notNull().default("email"),
    remindersPaused: boolean("reminders_paused").notNull().default(false),
    whatsappConsentAt: ts("whatsapp_consent_at"),
    archivedAt: ts("archived_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("clients_ws_idx").on(t.workspaceId), index("clients_created_idx").on(t.createdAt)],
);

export const clientNotes = pgTable(
  "client_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("cn_client_idx").on(t.clientId)],
);

/* ───────────── Invoices ───────────── */

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    number: text("number").notNull(),
    title: text("title"),
    currency: text("currency").notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("draft"), // draft | sent | cancelled | void
    sentAt: ts("sent_at"),
    viewedAt: ts("viewed_at"),
    voidedAt: ts("voided_at"),
    voidReason: text("void_reason"),
    discountType: text("discount_type").notNull().default("none"),
    discountValue: money("discount_value").notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 8, scale: 3 }).notNull().default("0"),
    subtotal: money("subtotal").notNull().default("0"),
    discountTotal: money("discount_total").notNull().default("0"),
    taxTotal: money("tax_total").notNull().default("0"),
    total: money("total").notNull().default("0"),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    archivedAt: ts("archived_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    recurringId: uuid("recurring_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_ws_number_uq").on(t.workspaceId, t.number),
    index("invoices_ws_idx").on(t.workspaceId),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_due_idx").on(t.dueDate),
    index("invoices_status_idx").on(t.status),
    index("invoices_created_idx").on(t.createdAt),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: money("unit_price").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [index("ii_invoice_idx").on(t.invoiceId)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // invoice_attachment | payment_proof
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    data: bytea("data").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("files_ws_idx").on(t.workspaceId), index("files_invoice_idx").on(t.invoiceId)],
);

/* ───────────── Payments ledger ───────────── */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    kind: text("kind").notNull().default("payment"), // payment | reversal
    amount: money("amount").notNull(), // negative for reversals
    currency: text("currency").notNull(),
    paidAt: date("paid_at", { mode: "string" }).notNull(),
    method: text("method").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    reason: text("reason"),
    reversesPaymentId: uuid("reverses_payment_id"),
    correctsPaymentId: uuid("corrects_payment_id"),
    verificationRequestId: uuid("verification_request_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payments_reverses_uq").on(t.reversesPaymentId),
    index("payments_ws_idx").on(t.workspaceId),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_client_idx").on(t.clientId),
    index("payments_created_idx").on(t.createdAt),
  ],
);

export const paymentVerificationRequests = pgTable(
  "payment_verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    reportedAmount: money("reported_amount"),
    reference: text("reference"),
    payerName: text("payer_name"),
    message: text("message"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // pending | under_review | approved | rejected
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
    paymentId: uuid("payment_id"),
    createdAt: createdAt(),
  },
  (t) => [index("pvr_ws_idx").on(t.workspaceId), index("pvr_invoice_idx").on(t.invoiceId), index("pvr_status_idx").on(t.status)],
);

/* ───────────── Reminders ───────────── */

export const reminderRules = pgTable(
  "reminder_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    offsetDays: integer("offset_days").notNull(), // negative = before due date
    channel: text("channel").notNull().default("email"), // email | whatsapp
    language: text("language").notNull().default("en"),
    templateKey: text("template_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("rr_ws_idx").on(t.workspaceId)],
);

export const reminderTemplates = pgTable(
  "reminder_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    language: text("language").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rt_ws_key_lang_uq").on(t.workspaceId, t.templateKey, t.language)],
);

export const reminderSchedules = pgTable(
  "reminder_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    ruleId: uuid("rule_id").references(() => reminderRules.id, { onDelete: "set null" }),
    scheduledAt: ts("scheduled_at").notNull(),
    channel: text("channel").notNull(),
    language: text("language").notNull(),
    templateKey: text("template_key").notNull(),
    // pending | processing | sent | failed | cancelled | skipped | action_needed
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(4),
    lastError: text("last_error"),
    sentAt: ts("sent_at"),
    cancelReason: text("cancel_reason"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rs_idem_uq").on(t.idempotencyKey),
    index("rs_ws_idx").on(t.workspaceId),
    index("rs_invoice_idx").on(t.invoiceId),
    index("rs_due_idx").on(t.status, t.scheduledAt),
  ],
);

export const reminderEvents = pgTable(
  "reminder_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id").references(() => reminderSchedules.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("re_ws_idx").on(t.workspaceId), index("re_schedule_idx").on(t.scheduleId)],
);

/* ───────────── Communications ───────────── */

export const communicationIntegrations = pgTable(
  "communication_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // email
    provider: text("provider").notNull(), // resend
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    replyTo: text("reply_to"),
    encryptedSecret: text("encrypted_secret").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    verifiedAt: ts("verified_at"),
    lastTestAt: ts("last_test_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ci_ws_kind_uq").on(t.workspaceId, t.kind)],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    scheduleId: uuid("schedule_id").references(() => reminderSchedules.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // reminder | invoice | test | confirmation
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    // queued | accepted | delivered | bounced | complained | failed
    status: text("status").notNull().default("queued"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("ed_ws_idx").on(t.workspaceId),
    index("ed_invoice_idx").on(t.invoiceId),
    index("ed_msg_idx").on(t.providerMessageId),
  ],
);

export const messagingDeliveries = pgTable(
  "messaging_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("whatsapp"),
    mode: text("mode").notNull(), // click_to_chat | business_api
    status: text("status").notNull(), // link_opened | api_accepted | failed
    detail: text("detail"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("md_ws_idx").on(t.workspaceId), index("md_invoice_idx").on(t.invoiceId)],
);

/* ───────────── Client portal ───────────── */

export const portalAccessTokens = pgTable(
  "portal_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    lastViewedAt: ts("last_viewed_at"),
    viewCount: integer("view_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pat_hash_uq").on(t.tokenHash), index("pat_invoice_idx").on(t.invoiceId)],
);

export const portalAccessEvents = pgTable(
  "portal_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenId: uuid("token_id").notNull().references(() => portalAccessTokens.id, { onDelete: "cascade" }),
    event: text("event").notNull(), // view | pdf | payment_report | denied
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("pae_token_idx").on(t.tokenId)],
);

/* ───────────── Platform ───────────── */

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    dedupeKey: text("dedupe_key"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notif_ws_idx").on(t.workspaceId, t.createdAt),
    uniqueIndex("notif_dedupe_uq").on(t.workspaceId, t.dedupeKey),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const recurringInvoices = pgTable(
  "recurring_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    title: text("title"),
    currency: text("currency").notNull(),
    items: jsonb("items").$type<{ description: string; quantity: string; unitPrice: string }[]>().notNull(),
    discountType: text("discount_type").notNull().default("none"),
    discountValue: text("discount_value").notNull().default("0"),
    taxRate: text("tax_rate").notNull().default("0"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),
    notes: text("notes"),
    frequency: text("frequency").notNull(), // weekly | monthly | quarterly | yearly | custom
    intervalDays: integer("interval_days"),
    nextRunDate: date("next_run_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    active: boolean("active").notNull().default(true),
    lastRunAt: ts("last_run_at"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("rec_ws_idx").on(t.workspaceId), index("rec_next_idx").on(t.nextRunDate)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

export const systemErrors = pgTable("system_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  requestId: text("request_id"),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

export const workerHeartbeats = pgTable("worker_heartbeats", {
  name: text("name").primaryKey(),
  lastRunAt: ts("last_run_at").notNull().defaultNow(),
  lastStatus: text("last_status").notNull().default("ok"),
  stats: jsonb("stats").$type<Record<string, unknown>>(),
});
