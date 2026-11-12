import { supabase, isSupabaseConfigured } from "./supabase.js";
import { showMessage, requireSupabase } from "./helpers.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!requireSupabase(isSupabaseConfigured ? supabase : null, message)) {
    return;
  }

  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Logging in…";

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  btn.disabled = false;
  btn.textContent = "Log in";

  if (error) {
    return showMessage(message, error.message, true);
  }

  location.href = "/dashboard";
});