export type TemplateKey = "upcoming" | "due_today" | "first_overdue" | "follow_up" | "final" | "payment_confirmation";
export type Language = "en" | "ur" | "roman_ur";

export const TEMPLATE_KEYS: TemplateKey[] = ["upcoming", "due_today", "first_overdue", "follow_up", "final", "payment_confirmation"];
export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  upcoming: "Upcoming due date",
  due_today: "Due today",
  first_overdue: "First overdue notice",
  follow_up: "Follow-up",
  final: "Final polite reminder",
  payment_confirmation: "Payment confirmation",
};
export const LANGUAGE_LABEL: Record<Language, string> = { en: "English", ur: "اردو (Urdu)", roman_ur: "Roman Urdu" };

export interface Template {
  subject: string;
  body: string;
}

export const TEMPLATE_VARIABLES = ["client_name", "invoice_number", "remaining_balance", "total", "due_date", "days_overdue", "business_name", "invoice_link"];

export const DEFAULT_TEMPLATES: Record<TemplateKey, Record<Language, Template>> = {
  upcoming: {
    en: {
      subject: "Upcoming payment — Invoice {{invoice_number}}",
      body: "Hello {{client_name}},\n\nThis is a friendly note that invoice {{invoice_number}} for {{remaining_balance}} is due on {{due_date}}.\n\nYou can view the invoice here: {{invoice_link}}\n\nPlease let us know if you have already completed the payment.\n\nThank you for working with us.\n{{business_name}}",
    },
    ur: {
      subject: "آنے والی ادائیگی — انوائس {{invoice_number}}",
      body: "محترم {{client_name}}،\n\nیہ ایک دوستانہ یاد دہانی ہے کہ انوائس {{invoice_number}} کی رقم {{remaining_balance}} کی آخری تاریخ {{due_date}} ہے۔\n\nانوائس یہاں دیکھیں: {{invoice_link}}\n\nاگر آپ ادائیگی کر چکے ہیں تو براہ کرم ہمیں مطلع کر دیں۔\n\nہمارے ساتھ کام کرنے کا شکریہ۔\n{{business_name}}",
    },
    roman_ur: {
      subject: "Aane wali adaigi — Invoice {{invoice_number}}",
      body: "Assalam o Alaikum {{client_name}},\n\nYeh aik dostana yaad dehani hai ke invoice {{invoice_number}} ki raqam {{remaining_balance}} ki aakhri tareekh {{due_date}} hai.\n\nInvoice yahan dekhein: {{invoice_link}}\n\nAgar aap adaigi kar chuke hain to meharbani kar ke humein bata dein.\n\nHumare saath kaam karne ka shukriya.\n{{business_name}}",
    },
  },
  due_today: {
    en: {
      subject: "Friendly Payment Reminder — Invoice {{invoice_number}}",
      body: "Hello {{client_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{remaining_balance}} is due today, {{due_date}}.\n\nView invoice: {{invoice_link}}\n\nPlease let us know if you have already completed the payment.\n\nThank you for working with us.\n{{business_name}}",
    },
    ur: {
      subject: "دوستانہ یاد دہانی — انوائس {{invoice_number}}",
      body: "محترم {{client_name}}،\n\nیہ ایک دوستانہ یاد دہانی ہے کہ انوائس {{invoice_number}} کی رقم {{remaining_balance}} کی آخری تاریخ آج، {{due_date}} ہے۔\n\nانوائس دیکھیں: {{invoice_link}}\n\nاگر آپ ادائیگی کر چکے ہیں تو براہ کرم ہمیں بتا دیں۔\n\nشکریہ۔\n{{business_name}}",
    },
    roman_ur: {
      subject: "Dostana yaad dehani — Invoice {{invoice_number}}",
      body: "Assalam o Alaikum {{client_name}},\n\nYeh dostana yaad dehani hai ke invoice {{invoice_number}} ki raqam {{remaining_balance}} aaj, {{due_date}} ko due hai.\n\nInvoice dekhein: {{invoice_link}}\n\nAgar aap adaigi kar chuke hain to meharbani kar ke bata dein.\n\nShukriya.\n{{business_name}}",
    },
  },
  first_overdue: {
    en: {
      subject: "Invoice {{invoice_number}} is now past due",
      body: "Hello {{client_name}},\n\nOur records show that invoice {{invoice_number}} for {{remaining_balance}} was due on {{due_date}} and is now {{days_overdue}} day(s) past due.\n\nView invoice: {{invoice_link}}\n\nIf the payment is already on its way, thank you — please just reply with the details so we can update our records.\n\nKind regards,\n{{business_name}}",
    },
    ur: {
      subject: "انوائس {{invoice_number}} کی مقررہ تاریخ گزر چکی ہے",
      body: "محترم {{client_name}}،\n\nہمارے ریکارڈ کے مطابق انوائس {{invoice_number}} کی رقم {{remaining_balance}} کی آخری تاریخ {{due_date}} تھی اور اب {{days_overdue}} دن گزر چکے ہیں۔\n\nانوائس دیکھیں: {{invoice_link}}\n\nاگر ادائیگی ہو چکی ہے تو شکریہ، براہ کرم تفصیل بھیج دیں تاکہ ہم ریکارڈ اپڈیٹ کر سکیں۔\n\nنیک تمنائیں،\n{{business_name}}",
    },
    roman_ur: {
      subject: "Invoice {{invoice_number}} ki due date guzar chuki hai",
      body: "Assalam o Alaikum {{client_name}},\n\nHamare record ke mutabiq invoice {{invoice_number}} ki raqam {{remaining_balance}} {{due_date}} ko due thi aur ab {{days_overdue}} din guzar chuke hain.\n\nInvoice dekhein: {{invoice_link}}\n\nAgar adaigi ho chuki hai to shukriya, meharbani kar ke tafseel bhej dein taake hum record update kar saken.\n\nKhair andeshi ke saath,\n{{business_name}}",
    },
  },
  follow_up: {
    en: {
      subject: "Following up — Invoice {{invoice_number}}",
      body: "Hello {{client_name}},\n\nI'm following up on invoice {{invoice_number}}, which has an outstanding balance of {{remaining_balance}} (due {{due_date}}).\n\nView invoice: {{invoice_link}}\n\nIf anything is unclear or you need a different arrangement, just reply to this message and we'll sort it out.\n\nThank you,\n{{business_name}}",
    },
    ur: {
      subject: "فالو اپ — انوائس {{invoice_number}}",
      body: "محترم {{client_name}}،\n\nمیں انوائس {{invoice_number}} کے بارے میں رابطہ کر رہا ہوں جس کی بقایا رقم {{remaining_balance}} ہے (آخری تاریخ {{due_date}})۔\n\nانوائس دیکھیں: {{invoice_link}}\n\nاگر کوئی بات واضح نہیں یا کسی اور انتظام کی ضرورت ہے تو اس پیغام کا جواب دیں۔\n\nشکریہ،\n{{business_name}}",
    },
    roman_ur: {
      subject: "Follow up — Invoice {{invoice_number}}",
      body: "Assalam o Alaikum {{client_name}},\n\nMain invoice {{invoice_number}} ke baare mein rabta kar raha hoon jis ki baqaya raqam {{remaining_balance}} hai (due date {{due_date}}).\n\nInvoice dekhein: {{invoice_link}}\n\nAgar koi baat wazeh nahi ya kisi aur intezam ki zaroorat hai to is paigham ka jawab dein.\n\nShukriya,\n{{business_name}}",
    },
  },
  final: {
    en: {
      subject: "Final reminder — Invoice {{invoice_number}}",
      body: "Hello {{client_name}},\n\nThis is a final courtesy reminder about invoice {{invoice_number}} with {{remaining_balance}} outstanding since {{due_date}}.\n\nView invoice: {{invoice_link}}\n\nWe'd really like to resolve this together. If there is a problem, please reply and let us know how we can help.\n\nWith thanks,\n{{business_name}}",
    },
    ur: {
      subject: "آخری یاد دہانی — انوائس {{invoice_number}}",
      body: "محترم {{client_name}}،\n\nیہ انوائس {{invoice_number}} کے بارے میں آخری یاد دہانی ہے جس کی {{remaining_balance}} رقم {{due_date}} سے بقایا ہے۔\n\nانوائس دیکھیں: {{invoice_link}}\n\nہم اس معاملے کو مل کر حل کرنا چاہتے ہیں۔ اگر کوئی مسئلہ ہے تو براہ کرم جواب دیں۔\n\nشکریہ،\n{{business_name}}",
    },
    roman_ur: {
      subject: "Aakhri yaad dehani — Invoice {{invoice_number}}",
      body: "Assalam o Alaikum {{client_name}},\n\nYeh invoice {{invoice_number}} ke baare mein aakhri yaad dehani hai jis ki {{remaining_balance}} raqam {{due_date}} se baqaya hai.\n\nInvoice dekhein: {{invoice_link}}\n\nHum is mamle ko mil kar hal karna chahte hain. Agar koi masla hai to meharbani kar ke jawab dein.\n\nShukriya,\n{{business_name}}",
    },
  },
  payment_confirmation: {
    en: {
      subject: "Payment received — Invoice {{invoice_number}}",
      body: "Hello {{client_name}},\n\nWe've recorded your payment for invoice {{invoice_number}}. The remaining balance is {{remaining_balance}}.\n\nView invoice: {{invoice_link}}\n\nThank you for your prompt payment.\n{{business_name}}",
    },
    ur: {
      subject: "ادائیگی موصول ہوئی — انوائس {{invoice_number}}",
      body: "محترم {{client_name}}،\n\nہم نے انوائس {{invoice_number}} کی آپ کی ادائیگی ریکارڈ کر لی ہے۔ بقایا رقم {{remaining_balance}} ہے۔\n\nانوائس دیکھیں: {{invoice_link}}\n\nبروقت ادائیگی کا شکریہ۔\n{{business_name}}",
    },
    roman_ur: {
      subject: "Adaigi mosool hui — Invoice {{invoice_number}}",
      body: "Assalam o Alaikum {{client_name}},\n\nHum ne invoice {{invoice_number}} ki aap ki adaigi record kar li hai. Baqaya raqam {{remaining_balance}} hai.\n\nInvoice dekhein: {{invoice_link}}\n\nBaroqt adaigi ka shukriya.\n{{business_name}}",
    },
  },
};

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => (k in vars ? vars[k] : ""));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Simple, safe HTML email wrapper. All dynamic text is escaped. */
export function renderEmailHtml(opts: { body: string; brandColor: string; businessName: string; footer?: string | null; link?: string; rtl?: boolean }): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(opts.brandColor) ? opts.brandColor : "#236B57";
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = opts.link
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.link)}" style="background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;display:inline-block">View invoice</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F5F4EF;font-family:Arial,Helvetica,sans-serif;color:#17211F">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border:1px solid #E5E7DF;border-top:4px solid ${color};border-radius:6px;padding:28px" ${opts.rtl ? 'dir="rtl"' : ""}>
<div style="font-size:13px;color:#748079;margin-bottom:16px">${escapeHtml(opts.businessName)}</div>
${paragraphs}${button}
</div>
<p style="font-size:12px;color:#748079;text-align:center;margin-top:16px">${escapeHtml(opts.footer || "")}</p>
</div></body></html>`;
}
