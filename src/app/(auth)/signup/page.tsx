import { redirect } from "next/navigation";
import Link from "next/link";
import { SignupForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getUser()) redirect("/app");
  return (
    <>
      <h1 className="m-0 text-[26px] font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-muted">Free to start. No card required.</p>
      <SignupForm />
      <p className="mt-6 text-center text-[13.5px] text-muted">Already have an account? <Link className="link" href="/login">Sign in</Link></p>
    </>
  );
}
