import type { ReactNode } from "react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="main">{children}</main>
      <MarketingFooter />
    </>
  );
}
