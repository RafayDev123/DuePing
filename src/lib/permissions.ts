export const ROLES = ["owner", "admin", "accountant", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "read"
  | "clients.write"
  | "invoices.write"
  | "payments.write"
  | "reminders.manage"
  | "settings.manage"
  | "team.manage"
  | "import.run"
  | "workspace.delete";

const MATRIX: Record<Permission, Role[]> = {
  read: ["owner", "admin", "accountant", "member", "viewer"],
  "clients.write": ["owner", "admin", "accountant", "member"],
  "invoices.write": ["owner", "admin", "accountant", "member"],
  "payments.write": ["owner", "admin", "accountant"],
  "reminders.manage": ["owner", "admin"],
  "settings.manage": ["owner", "admin"],
  "team.manage": ["owner", "admin"],
  "import.run": ["owner", "admin", "accountant"],
  "workspace.delete": ["owner"],
};

export function can(role: Role | string | null | undefined, perm: Permission): boolean {
  return !!role && (MATRIX[perm] as string[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  member: "Member",
  viewer: "Read-only viewer",
};
