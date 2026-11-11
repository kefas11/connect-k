// Add the Supabase Project URL and anon/publishable key here.
// Never use a service_role or secret key in browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = "https://fqifsneaqvcemdxaunjv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CzzDEH_PEjx3A7dcXgNZ6A_DRIBSU4i";
export const isSupabaseConfigured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}) : null;
