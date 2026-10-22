import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = String(process.env.BETA_APPROVER_EMAIL || "").trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("Beta approver account is not configured");
initializeApp();
const account = await getAuth().getUserByEmail(email);
if (account.disabled || String(account.email || "").toLowerCase() !== email) {
  throw new Error("Beta approver account is not active");
}
process.stdout.write(`BETA_APPROVER_UID=${account.uid}\n`);
