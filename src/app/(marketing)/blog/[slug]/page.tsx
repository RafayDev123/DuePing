import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, CtaBand, JsonLd } from "@/components/marketing";
import { AUTHOR, POSTS, SITE_URL, breadcrumbJsonLd, orgJsonLd } from "@/lib/site";
import { formatDate } from "@/lib/dates";

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: p.title, description: p.description, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: "article", title: p.title, description: p.description, url: `/blog/${p.slug}`, publishedTime: p.published, modifiedTime: p.updated, authors: [AUTHOR.name] } };
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) notFound();
  const article = {
    "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description, datePublished: p.published, dateModified: p.updated,
    author: { "@type": "Organization", name: AUTHOR.name }, publisher: { "@type": "Organization", name: "DuePing", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` } }, mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
  };
  return (
    <>
      <JsonLd data={[article, orgJsonLd, breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/blog" }, { name: p.title, path: `/blog/${p.slug}` }])]} />
      <article className="mx-auto max-w-[720px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/blog", label: "Guides" }, { label: p.title }]} />
        <h1 className="m-0 text-[clamp(1.8rem,4.2vw,2.5rem)] font-semibold leading-tight">{p.title}</h1>
        <p className="mt-3 text-[13px] text-muted">By {AUTHOR.name} · {AUTHOR.editor} · Published <time dateTime={p.published}>{formatDate(p.published)}</time> · Updated <time dateTime={p.updated}>{formatDate(p.updated)}</time></p>
        <section aria-label="Short answer" className="mt-6 rounded-lg border-l-4 bg-surface p-5" style={{ borderColor: "var(--accent)" }}><p className="m-0 text-[16px] leading-relaxed"><b>Short answer:</b> {p.direct}</p></section>
        <div className="prose-dp mt-6 text-[16px]">
          {p.blocks.map((b, i) => b.t === "h2" ? <h2 key={i}>{b.text}</h2> : b.t === "p" ? <p key={i}>{b.text}</p> : b.t === "quote" ? <blockquote key={i}>{b.text}</blockquote> : b.t === "ul" ? <ul key={i}>{b.items!.map((it) => <li key={it}>{it}</li>)}</ul> : <ol key={i}>{b.items!.map((it) => <li key={it}>{it}</li>)}</ol>)}
        </div>
        {p.sources.length > 0 && <aside className="mt-8 border-t border-line pt-4 text-[13.5px]"><h2 className="m-0 mb-2 text-[14px] font-semibold">Sources</h2><ul className="m-0 list-disc pl-5">{p.sources.map((s) => <li key={s.url}><a className="link" href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul></aside>}
        <p className="mt-6 text-[13px] text-muted">This guide is general information, not legal or financial advice. Related guides: {POSTS.filter((x) => x.slug !== p.slug).slice(0, 3).map((x, i) => <span key={x.slug}>{i > 0 && " · "}<Link className="link" href={`/blog/${x.slug}`}>{x.title}</Link></span>)}</p>
      </article>
      <CtaBand title="Put the reminder on a schedule" sub="DuePing keeps every invoice, payment and follow-up in one place." />
    </>
  );
}
