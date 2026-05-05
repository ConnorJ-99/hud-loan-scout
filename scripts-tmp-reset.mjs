import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }
const admin = createClient(url, key);
const userId = "2c365de0-006e-4550-aa99-9cce86bd5453";
const { data, error } = await admin.auth.admin.updateUserById(userId, {
  password: "AdminMPS#2026!",
  email_confirm: true,
});
if (error) { console.error(error); process.exit(1); }
console.log("ok", data.user?.email);
