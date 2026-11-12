import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = selector => document.querySelector(selector);

async function initializeMember() {
  if (!isSupabaseConfigured || !supabase) {
    location.href = "/login";
    return;
  }

  const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !session) {
    location.href = "/login";
    return;
  }

  const memberId = new URLSearchParams(location.search).get("id");

  if (!memberId) {
    $("#member-message").textContent = "No member was selected.";
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, cover_url, bio, institution, interests"
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error || !profile) {
    $("#member-name").textContent = "Profile unavailable";
    $("#member-message").textContent =
      "This profile could not be found.";
    return;
  }

  $("#member-name").textContent =
    profile.display_name || "CONNECT-K member";

  $("#member-username").textContent =
    `@${profile.username}`;

  $("#member-bio").textContent =
    profile.bio || "This member hasn't added a bio yet.";

  $("#member-institution").textContent =
    profile.institution || "Not provided";

  const avatar = $("#member-avatar");

  avatar.textContent =
    (profile.display_name || "K").charAt(0).toUpperCase();

  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url("${profile.avatar_url}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.textContent = "";
  }

  if (profile.cover_url) {
    $("#member-cover").style.backgroundImage =
      `url("${profile.cover_url}")`;
    $("#member-cover").style.backgroundSize = "cover";
    $("#member-cover").style.backgroundPosition = "center";
  }

  const interests = $("#member-interests");
  interests.replaceChildren();

  if (profile.interests?.length) {
    profile.interests.forEach(item => {
      const tag = document.createElement("span");
      tag.textContent = item;
      tag.style.cssText =
        "display:inline-block;margin:5px;padding:7px 12px;" +
        "border-radius:20px;background:rgba(220,197,165,.12);" +
        "color:#dcc5a5;font-size:12px;";
      interests.append(tag);
    });
  } else {
    interests.textContent = "Not provided";
  }
}

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

initializeMember();