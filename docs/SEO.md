# SEO, AEO, GEO

* Server-rendered public pages (static where possible); private areas (`/app`, `/admin`, `/portal`, `/invite`, auth utility pages) are `noindex` and disallowed in `robots.txt`.
* `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`, `icon.svg`, `opengraph-image.tsx`; per-page titles, unique descriptions, canonical URLs, Open Graph/Twitter metadata.
* JSON-LD: Organization, WebSite, SoftwareApplication (free offer only), BreadcrumbList, Article (guides, with author + dates), FAQPage (home, /faq).
* AEO: each feature page and guide opens with a short direct answer; question-style headings; step lists; original templates; visible published/updated dates; author/editor lines; sources linked where factual claims are made.
* No testimonials, ratings, customer counts or performance claims anywhere. Pricing page states that paid plans do not exist yet.
* Set `NEXT_PUBLIC_APP_URL` to the production origin so canonical URLs and the sitemap are correct. Submit the sitemap in Google Search Console and Bing Webmaster Tools. Nothing here guarantees rankings or inclusion in AI answers.
