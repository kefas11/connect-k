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

async function toggleLike(postId, isLiked, button) {
  button.disabled = true;

  try {
    let result;

    if (isLiked) {
      result = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUser.id);
    } else {
      result = await supabase
        .from("post_likes")
        .insert({
          post_id: postId,
          user_id: currentUser.id
        });
    }

    if (result.error) throw result.error;

    await loadPosts();

  } catch (error) {
    console.error("Like error:", error);
    showMessage(error.message || "Could not update your like.", true);
    button.disabled = false;
  }
}

function createPostElement(post, profile, likeInfo) {
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
    avatar.style.backgroundImage = `url("${profile.avatar_url}")`;
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

  // Like section
  const likeSection = document.createElement("div");
  likeSection.style.cssText =
    "display:flex;align-items:center;gap:12px;" +
    "margin-top:18px;padding-top:14px;" +
    "border-top:1px solid rgba(255,255,255,0.1);";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.textContent = likeInfo.isLiked ? "♥ Liked" : "♡ Like";
  likeButton.setAttribute("aria-pressed", String(likeInfo.isLiked));

  likeButton.style.cssText =
    "background:transparent;border:1px solid rgba(220,197,165,0.4);" +
    "color:#dcc5a5;padding:9px 17px;border-radius:25px;" +
    "cursor:pointer;font:inherit;font-weight:600;";

  const likeCount = document.createElement("span");
  likeCount.className = "muted";
  likeCount.textContent =
    `${likeInfo.count} ${likeInfo.count === 1 ? "like" : "likes"}`;

  if (!likeInfo.available) {
    likeButton.disabled = true;
    likeButton.title = "Likes could not be loaded.";
  } else {
    likeButton.addEventListener("click", () => {
      toggleLike(post.id, likeInfo.isLiked, likeButton);
    });
  }

  likeSection.append(likeButton, likeCount);
  article.append(likeSection);

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
  const postIds = posts.map(post => post.id);

  const [profileResult, likeResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds),

    supabase
      .from("post_likes")
      .select("post_id, user_id")
      .in("post_id", postIds)
  ]);

  if (profileResult.error) {
    console.error("Profile lookup error:", profileResult.error);
  }

  if (likeResult.error) {
    console.error("Likes lookup error:", likeResult.error);
  }

  const profileMap = new Map(
    (profileResult.data || []).map(profile => [
      profile.id,
      profile
    ])
  );

  const likes = likeResult.data || [];

  const likeMap = new Map();

  likes.forEach(like => {
    if (!likeMap.has(like.post_id)) {
      likeMap.set(like.post_id, []);
    }

    likeMap.get(like.post_id).push(like.user_id);
  });

  posts.forEach(post => {
    const profile = profileMap.get(post.user_id);
    const postLikes = likeMap.get(post.id) || [];

    const likeInfo = {
      count: postLikes.length,
      isLiked: postLikes.includes(currentUser.id),
      available: !likeResult.error
    };

    postsContainer.append(
      createPostElement(post, profile, likeInfo)
    );
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