/**
 * Loads clearly-labelled demo data ("[Demo]" prefix, is_demo = true) into a user's first workspace.
 *   npm run seed -- you@example.com
 */
import "dotenv/config";
import { one, sql } from "@/lib/sql";
import { loadDemoData } from "@/services/demo";

async function main() {
  const email = (process.argv[2] || "").toLowerCase();
  if (!email) throw new Error("Usage: npm run seed -- <account email>");
  const row = await one<{ user_id: string; workspace_id: string }>(sql`
    select u.id as user_id, m.workspace_id from users u join workspace_members m on m.user_id = u.id where u.email = ${email} order by m.created_at limit 1`);
  if (!row) throw new Error(`No account found for ${email}. Sign up first.`);
  await loadDemoData(row.workspace_id, row.user_id);
  console.log("Demo data loaded into workspace", row.workspace_id);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
