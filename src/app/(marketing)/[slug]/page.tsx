import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, CtaBand, JsonLd } from "@/components/marketing";
import { FEATURE_PAGES, breadcrumbJsonLd, UPDATED } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = FEATURE_PAGES.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: p.metaTitle, description: p.description, alternates: { canonical: `/${p.slug}` }, openGraph: { title: p.metaTitle, description: p.description, url: `/${p.slug}` } };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = FEATURE_PAGES.find((x) => x.slug === slug);
  if (!p) notFound();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Features", path: "/features" }, { name: p.eyebrow, path: `/${p.slug}` }])} />
      <article className="mx-auto max-w-[900px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/features", label: "Features" }, { label: p.eyebrow }]} />
        <p className="m-0 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>{p.eyebrow}</p>
        <h1 className="m-0 mt-2 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold leading-tight">{p.title}</h1>
        <p className="mt-4 text-[18px] text-muted">{p.intro}</p>
        <section aria-label="Short answer" className="mt-8 rounded-lg border-l-4 bg-surface p-5" style={{ borderColor: "var(--accent)" }}><p className="m-0 text-[15.5px] leading-relaxed">{p.answer}</p></section>
        <h2 className="mb-4 mt-12 text-[24px] font-semibold">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2">{p.points.map((pt) => <div key={pt.title} className="card p-5"><h3 className="m-0 mb-1 text-[15px] font-semibold">{pt.title}</h3><p className="m-0 text-[14px] text-muted">{pt.body}</p></div>)}</div>
        <h2 className="mb-4 mt-12 text-[24px] font-semibold">How it works</h2>
        <ol className="m-0 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <aside className="mt-12 rounded-lg p-5 text-[14px]" style={{ background: "var(--neutral-soft)" }}><b>Honest limits.</b> {p.honest}</aside>
        <p className="mt-8 text-[13px] text-muted">Last updated {UPDATED}. Related: {FEATURE_PAGES.filter((x) => x.slug !== p.slug).map((x, i) => <span key={x.slug}>{i > 0 && ", "}<Link className="link" href={`/${x.slug}`}>{x.eyebrow}</Link></span>)}.</p>
      </article>
      <CtaBand />
    </>
  );
}
