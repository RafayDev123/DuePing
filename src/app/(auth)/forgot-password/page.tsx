import Link from "next/link";
import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="m-0 text-[26px] font-semibold">Reset your password</h1>
      <p className="mb-6 mt-1 text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-[13.5px]"><Link className="link" href="/login">Back to sign in</Link></p>
    </>
  );
}
