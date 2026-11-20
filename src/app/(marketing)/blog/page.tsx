import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs, JsonLd } from "@/components/marketing";
import { AUTHOR, POSTS, breadcrumbJsonLd } from "@/lib/site";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Guides on invoices and payment follow-up", description: "Practical guides: reminding clients about unpaid invoices, tracking partial payments, overdue email wording and aging reports.", alternates: { canonical: "/blog" } };

export default function BlogIndex() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/blog" }])} />
      <div className="mx-auto max-w-[820px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Guides" }]} />
        <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Guides</h1>
        <p className="mb-8 mt-3 text-muted">Original, practical answers to common invoicing questions. By the {AUTHOR.name}.</p>
        <ul className="m-0 list-none divide-y divide-line p-0">
          {POSTS.map((p) => (
            <li key={p.slug} className="py-6"><Link href={`/blog/${p.slug}`} className="group block"><h2 className="m-0 text-[20px] font-semibold group-hover:underline">{p.title}</h2><p className="mb-1 mt-2 text-[14.5px] text-muted">{p.direct}</p><p className="m-0 text-[12.5px] text-muted">Published {formatDate(p.published)} · Updated {formatDate(p.updated)} · {p.readMins} min read</p></Link></li>
          ))}
        </ul>
      </div>
    </>
  );
}
