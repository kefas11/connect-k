export function showMessage(el,text,isError=false){if(!el)return;el.textContent=text;el.style.color=isError?"#ff858d":"#dcc5a5"}
export function requireSupabase(client,el){if(client)return true;showMessage(el,"Setup is not finished. Add your Supabase URL and publishable key in js/supabase.js.",true);return false}
