import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const form = $("#post-form");
const contentInput = $("#post-content");
const mediaInput = $("#post-media");
const message = $("#post-message");
const publishButton = $("#publish-button");
const postsContainer = $("#posts-container");

let currentUser = null;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function formatDate(date) {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function uploadMedia(file) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Choose a JPG, PNG, WebP, MP4 or WebM file.");
  }

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Your file must be 50 MB or smaller.");
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const filePath =
    `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("posts-media")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("posts-media")
    .getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    type: file.type.startsWith("video/") ? "video" : "image"
  };
}

async function publishPost(event) {
  event.preventDefault();

  const content = contentInput.value.trim();
  const file = mediaInput.files[0];

  if (!content) {
    showMessage("Please write something before publishing.", true);
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = "Publishing...";

  try {
    let media = {
      url: null,
      type: null
    };

    if (file) {
      showMessage("Uploading your media...");
      media = await uploadMedia(file);
    }

    showMessage("Publishing your post...");

    const { error } = await supabase
      .from("posts")
      .insert({
        user_id: currentUser.id,
        content,
        media_url: media.url,
        media_type: media.type
      });

    if (error) throw error;

    form.reset();
    showMessage("Your post has been published successfully!");

    await loadPosts();

  } catch (error) {
    console.error("Post error:", error);
    showMessage(error.message || "Could not publish your post.", true);
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = "Publish post";
  }
}

function createPostElement(post, profile) {
  const article = document.createElement("article");
  article.className = "feature-card";
  article.style.cssText = "padding:22px;margin-bottom:18px;";

  const authorRow = document.createElement("div");
  authorRow.style.cssText =
    "display:flex;align-items:center;gap:12px;margin-bottom:15px;";

  const avatar = document.createElement("div");
  avatar.style.cssText =
    "width:44px;height:44px;border-radius:50%;background:#263d30;" +
    "background-size:cover;background-position:center;display:grid;" +
    "place-items:center;color:#f4eee4;font-weight:600;flex-shrink:0;";

  if (profile?.avatar_url) {
    avatar.style.backgroundImage =
      `url("${profile.avatar_url}")`;
  } else {
    avatar.textContent =
      (profile?.display_name || "K").charAt(0).toUpperCase();
  }

  const authorInfo = document.createElement("div");

  const name = document.createElement("strong");
  name.textContent = profile?.display_name || "CONNECT-K member";

  const username = document.createElement("p");
  username.className = "muted";
  username.style.margin = "3px 0";
  username.textContent = profile?.username
    ? `@${profile.username}`
    : "";

  authorInfo.append(name, username);
  authorRow.append(avatar, authorInfo);

  const date = document.createElement("p");
  date.className = "muted";
  date.style.fontSize = "12px";
  date.textContent = formatDate(post.created_at);

  const content = document.createElement("p");
  content.style.cssText = "white-space:pre-wrap;line-height:1.7;";
  content.textContent = post.content;

  article.append(authorRow, date, content);

  if (post.media_url) {
    if (post.media_type === "video") {
      const video = document.createElement("video");
      video.src = post.media_url;
      video.controls = true;
      video.preload = "metadata";
      video.style.cssText =
        "width:100%;max-height:480px;object-fit:contain;" +
        "border-radius:12px;margin-top:12px;";
      article.append(video);
    } else if (post.media_type === "image") {
      const image = document.createElement("img");
      image.src = post.media_url;
      image.alt = "Post image";
      image.loading = "lazy";
      image.style.cssText =
        "width:100%;max-height:480px;object-fit:contain;" +
        "border-radius:12px;margin-top:12px;";
      article.append(image);
    }
  }

  return article;
}

async function loadPosts() {
  postsContainer.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading community posts...";
  postsContainer.append(loading);

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, content, media_url, media_type, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Feed error:", error);
    postsContainer.textContent =
      "Could not load posts: " + error.message;
    return;
  }

  postsContainer.replaceChildren();

  if (!posts || posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent =
      "No posts yet. Be the first to share something!";
    postsContainer.append(empty);
    return;
  }

  const userIds = [...new Set(posts.map(post => post.user_id))];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  if (profileError) {
    console.error("Profile lookup error:", profileError);
  }

  const profileMap = new Map(
    (profiles || []).map(profile => [profile.id, profile])
  );

  posts.forEach(post => {
    const profile = profileMap.get(post.user_id);
    postsContainer.append(createPostElement(post, profile));
  });
}

async function initializeFeed() {
  if (!isSupabaseConfigured || !supabase) {
    showMessage("Supabase is not configured.", true);
    return;
  }

  const { data: { session }, error } =
    await supabase.auth.getSession();

  if (error || !session) {
    location.href = "login.html";
    return;
  }

  currentUser = session.user;

  await loadPosts();
}

form.addEventListener("submit", publishPost);

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
});

initializeFeed();