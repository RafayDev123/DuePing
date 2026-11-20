import { redirect } from "next/navigation";
import Link from "next/link";
import { NewWorkspaceForm } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { getUser } from "@/lib/auth";

export const metadata = { title: "New workspace", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewWorkspacePage() {
  if (!(await getUser())) redirect("/login");
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 py-10">
      <Link href="/app" className="mb-8"><Logo /></Link>
      <h1 className="m-0 text-[24px] font-semibold">Create a business workspace</h1>
      <p className="mb-6 mt-1 text-muted">Keep another business&apos;s clients, invoices and branding completely separate.</p>
      <NewWorkspaceForm />
    </main>
  );
}
