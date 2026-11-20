import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth-forms";

export const metadata = { title: "Verify your email" };

export default function VerifyPage() {
  return (
    <>
      <h1 className="m-0 mb-4 text-[26px] font-semibold">Email verification</h1>
      <Suspense><VerifyEmail /></Suspense>
    </>
  );
}
