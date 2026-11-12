import { supabase, isSupabaseConfigured } from "./supabase.js";
import { showMessage, requireSupabase } from "./helpers.js";

const form = document.querySelector("#reset-form");
const message = document.querySelector("#form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!requireSupabase(isSupabaseConfigured ? supabase : null, message)) {
    return;
  }

  const password = document.querySelector("#password").value;
  const confirm = document.querySelector("#confirm-password").value;

  if (password.length < 8) {
    return showMessage(message, "Use at least 8 characters.", true);
  }

  if (password !== confirm) {
    return showMessage(message, "Your passwords do not match.", true);
  }

  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Saving…";

  const { error } = await supabase.auth.updateUser({ password });

  btn.disabled = false;
  btn.textContent = "Save new password";

  if (error) {
    return showMessage(message, error.message, true);
  }

  showMessage(message, "Password updated. You can now log in.");

  setTimeout(() => {
    location.href = "/login";
  }, 1800);
});