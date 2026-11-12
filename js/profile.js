import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const form = $("#profile-form");
const message = $("#profile-message");
const saveButton = $("#save-profile");

const avatarInput = $("#avatar-input");
const coverInput = $("#cover-input");

const avatarButton = $("#avatar-upload-button");
const coverButton = $("#cover-upload-button");
const logoutButton = $("#logout-button");

let currentUser = null;
let currentProfile = null;
let uploading = false;

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function displayProfile(profile) {
  $("#profile-display-name").textContent =
    profile.display_name || "Your name";

  $("#profile-username").textContent =
    `@${profile.username || "username"}`;

  $("#display-name-input").value = profile.display_name || "";
  $("#username-input").value = profile.username || "";
  $("#bio-input").value = profile.bio || "";
  $("#institution-input").value = profile.institution || "";

  $("#interests-input").value =
    (profile.interests || []).join(", ");

  const avatar = $("#avatar-preview");

  avatar.textContent =
    (profile.display_name || "K").charAt(0).toUpperCase();

  avatar.style.backgroundImage = profile.avatar_url
    ? `url("${profile.avatar_url}")`
    : "";

  avatar.classList.toggle("has-image", Boolean(profile.avatar_url));

  const cover = $("#cover-preview");

  cover.style.backgroundImage = profile.cover_url
    ? `url("${profile.cover_url}")`
    : "";

  cover.classList.toggle("has-image", Boolean(profile.cover_url));
}

async function loadProfile() {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    location.href = "/login";
    return;
  }

  currentUser = session.user;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, cover_url, bio, institution, interests"
    )
    .eq("id", currentUser.id)
    .single();

  if (error) {
    showMessage("Could not load your profile: " + error.message, true);
    return;
  }

  currentProfile = data;
  displayProfile(data);
}

// Open the native file picker directly from the user's button click.
function openImagePicker(input) {
  if (!input) {
    showMessage("The image picker could not be found. Please refresh the page.", true);
    return;
  }

  input.click();
}

avatarButton?.addEventListener("click", () => {
  openImagePicker(avatarInput);
});

coverButton?.addEventListener("click", () => {
  openImagePicker(coverInput);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    showMessage("Your profile is still loading. Please try again.", true);
    return;
  }

  const displayName = $("#display-name-input").value.trim();
  const username = $("#username-input").value.trim().toLowerCase();
  const bio = $("#bio-input").value.trim();
  const institution = $("#institution-input").value.trim();

  const interests = $("#interests-input").value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (!displayName || displayName.length > 60) {
    showMessage("Display name must be between 1 and 60 characters.", true);
    return;
  }

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    showMessage(
      "Username must be 3–24 characters using letters, numbers or underscores.",
      true
    );
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username,
        bio: bio || null,
        institution: institution || null,
        interests
      })
      .eq("id", currentUser.id)
      .select(
        "id, username, display_name, avatar_url, cover_url, bio, institution, interests"
      )
      .single();

    if (error) throw error;

    currentProfile = data;
    displayProfile(data);

    showMessage("Your profile has been saved successfully.");

  } catch (error) {
    showMessage(
      error.code === "23505"
        ? "That username is already taken. Choose another."
        : "Could not save your profile: " + error.message,
      true
    );

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
  }
});

async function uploadImage(file, type) {
  if (!currentUser || !currentProfile) {
    showMessage("Your profile is still loading. Please try again.", true);
    return;
  }

  if (uploading) {
    showMessage("Please wait for the current image upload to finish.");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage("Please choose a JPG, PNG or WebP image.", true);
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage("Your image must be 5 MB or smaller.", true);
    return;
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[file.type];

  const filePath =
    `${currentUser.id}/${type}_${Date.now()}.${extension}`;

  uploading = true;

  if (avatarButton) avatarButton.disabled = true;
  if (coverButton) coverButton.disabled = true;

  showMessage(
    `Uploading ${type === "avatar" ? "profile picture" : "cover photo"}...`
  );

  try {
    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("profile-media")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    const updateField = type === "avatar"
      ? { avatar_url: imageUrl }
      : { cover_url: imageUrl };

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update(updateField)
      .eq("id", currentUser.id)
      .select(
        "id, username, display_name, avatar_url, cover_url, bio, institution, interests"
      )
      .single();

    if (updateError) throw updateError;

    currentProfile = data;
    displayProfile(data);

    showMessage(
      type === "avatar"
        ? "Profile picture updated successfully."
        : "Cover photo updated successfully."
    );

  } catch (error) {
    console.error("Image upload failed:", error);
    showMessage("Image upload failed: " + error.message, true);

  } finally {
    uploading = false;

    if (avatarButton) avatarButton.disabled = false;
    if (coverButton) coverButton.disabled = false;
  }
}

avatarInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (file) {
    await uploadImage(file, "avatar");
  }

  event.target.value = "";
});

coverInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (file) {
    await uploadImage(file, "cover");
  }

  event.target.value = "";
});

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

if (!isSupabaseConfigured || !supabase) {
  location.href = "/login";
} else {
  await loadProfile();
}