import {
  supabase,
  isSupabaseConfigured
} from "./supabase.js";

import {
  showMessage,
  requireSupabase
} from "./helpers.js";

const form = document.querySelector("#forgot-form");
const message = document.querySelector("#form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!requireSupabase(
    isSupabaseConfigured ? supabase : null,
    message
  )) return;

  const email = document
    .querySelector("#email")
    .value
    .trim()
    .toLowerCase();

  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Sending...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://connect-k-bay.vercel.app/reset-password"
  });

  btn.disabled = false;
  btn.textContent = "Send reset link";

  if (error) {
    showMessage(message, error.message, true);
    return;
  }

  showMessage(
    message,
    "If an account exists for that email, a reset link will be sent. Check your inbox."
  );
});