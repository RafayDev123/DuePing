import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import Link from "next/link";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getUser()) redirect("/app");
  const sp = await searchParams;
  return (
    <>
      <h1 className="m-0 text-[26px] font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-muted">Sign in to your DuePing workspace.</p>
      {sp.reset && <p role="status" className="mb-4 rounded-md bg-accentsoft p-3 text-[13.5px]" style={{ color: "var(--accent-text)" }}>Password updated. Sign in with your new password.</p>}
      <Suspense><LoginForm /></Suspense>
      <p className="mt-6 text-center text-[13.5px] text-muted">New to DuePing? <Link className="link" href="/signup">Create an account</Link></p>
    </>
  );
}
