import { supabase, isSupabaseConfigured } from "./supabase.js";
import { showMessage, requireSupabase } from "./helpers.js";

const form = document.querySelector("#signup-form");
const message = document.querySelector("#form-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!requireSupabase(isSupabaseConfigured ? supabase : null, message)) {
    return;
  }

  const name = document.querySelector("#name").value.trim();
  const username = document.querySelector("#username").value.trim().toLowerCase();
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  const confirm = document.querySelector("#confirm-password").value;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return showMessage(
      message,
      "Username must be 3–24 characters: letters, numbers or underscores.",
      true
    );
  }

  if (password.length < 8) {
    return showMessage(message, "Use at least 8 characters.", true);
  }

  if (password !== confirm) {
    return showMessage(message, "Your passwords do not match.", true);
  }

  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Creating account…";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        username
      },
      emailRedirectTo: `${location.origin}/dashboard`
    }
  });

  btn.disabled = false;
  btn.textContent = "Create my account";

  if (error) {
    return showMessage(message, error.message, true);
  }

  if (data.session) {
    location.href = "/dashboard";
  } else {
    showMessage(
      message,
      "Account created. Check your email to verify your address, then log in."
    );
  }
});