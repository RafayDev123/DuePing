import { AcceptInvite } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { previewInvite } from "@/services/team";

export const metadata = { title: "Workspace invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = /^[A-Za-z0-9_-]{30,64}$/.test(token) ? await previewInvite(token) : null;
  const user = await getUser();
  if (!inv) return <><h1 className="m-0 text-[24px] font-semibold">Invitation not valid</h1><p className="text-muted">This invitation has expired, was revoked, or was already used. Ask the workspace owner for a new one.</p></>;
  return (
    <>
      <h1 className="m-0 text-[24px] font-semibold">Join {inv.workspace_name}</h1>
      <p className="mb-6 mt-1 text-muted">You&apos;ve been invited as <b>{ROLE_LABEL[inv.role]}</b> ({inv.email}).</p>
      <AcceptInvite token={token} signedInAs={user?.email ?? null} />
    </>
  );
}
