import { supabase, isSupabaseConfigured } from "./supabase.js";

const container = document.querySelector("#connections-container");
const searchInput = document.querySelector("#connection-search");
const countText = document.querySelector("#connection-count");
const logoutButton = document.querySelector("#logout-button");

let connections = [];

function showMessage(message, isError = false) {
  container.textContent = message;
  container.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function createConnectionCard(person) {
  const card = document.createElement("article");
  card.className = "feature-card";

  card.style.cssText =
    "padding:20px;display:flex;align-items:center;gap:15px;flex-wrap:wrap;";

  const avatar = document.createElement("div");

  avatar.style.cssText =
    "width:60px;height:60px;border-radius:50%;" +
    "background:#263d30;display:grid;place-items:center;" +
    "overflow:hidden;color:#f4eee4;font-size:22px;flex-shrink:0;";

  if (person.avatar_url) {
    const image = document.createElement("img");
    image.src = person.avatar_url;
    image.alt = "";
    image.style.cssText =
      "width:100%;height:100%;object-fit:cover;";
    avatar.append(image);
  } else {
    avatar.textContent =
      (person.display_name || "K").charAt(0).toUpperCase();
  }

  const details = document.createElement("div");
  details.style.cssText = "flex:1;min-width:140px;";

  const name = document.createElement("h3");
  name.textContent = person.display_name || "CONNECT-K member";
  name.style.margin = "0 0 5px";

  const username = document.createElement("p");
  username.className = "muted";
  username.textContent = `@${person.username}`;
  username.style.margin = "0";

  details.append(name, username);

  const profileLink = document.createElement("a");

  profileLink.href =
    `/member?id=${encodeURIComponent(person.id)}`;

  profileLink.textContent = "View profile";

  profileLink.style.cssText =
    "color:#ed7b83;font-size:13px;font-weight:600;";

  card.append(avatar, details, profileLink);

  return card;
}

function renderConnections() {
  const search = searchInput.value.trim().toLowerCase();

  const filtered = connections.filter(person => {
    const text = [
      person.display_name,
      person.username
    ].join(" ").toLowerCase();

    return text.includes(search);
  });

  container.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";

    empty.textContent = search
      ? "No connections match your search."
      : "You haven't connected with anyone yet. Visit Discover to meet people.";

    container.append(empty);
    return;
  }

  filtered.forEach(person => {
    container.append(createConnectionCard(person));
  });
}

async function loadConnections() {
  showMessage("Loading your connections...");
  countText.textContent = "Loading...";

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    location.href = "/login";
    return;
  }

  const userId = session.user.id;

  const { data: requests, error: requestError } = await supabase
    .from("connection_requests")
    .select("sender_id, receiver_id")
    .eq("status", "accepted")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (requestError) {
    console.error(requestError);
    countText.textContent = "";
    showMessage(
      "Could not load your connections: " + requestError.message,
      true
    );
    return;
  }

  const memberIds = [...new Set(
    (requests || []).map(request =>
      request.sender_id === userId
        ? request.receiver_id
        : request.sender_id
    )
  )];

  if (memberIds.length === 0) {
    connections = [];
    countText.textContent = "0 connections";
    renderConnections();
    return;
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", memberIds)
    .order("display_name", { ascending: true });

  if (profileError) {
    console.error(profileError);
    showMessage(
      "Could not load connection profiles: " + profileError.message,
      true
    );
    return;
  }

  connections = profiles || [];

  countText.textContent =
    `${connections.length} ${
      connections.length === 1 ? "connection" : "connections"
    }`;

  renderConnections();
}

searchInput.addEventListener("input", renderConnections);

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

if (!isSupabaseConfigured || !supabase) {
  location.href = "/login";
} else {
  await loadConnections();
}