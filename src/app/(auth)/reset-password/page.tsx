import { Suspense } from "react";
import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="m-0 text-[26px] font-semibold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-muted">Reset links expire after one hour.</p>
      <Suspense><ResetForm /></Suspense>
    </>
  );
}
