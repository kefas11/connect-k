import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const container = $("#discover-container");
const searchInput = $("#discover-search");
const logoutButton = $("#logout-button");

let currentUser = null;
let currentProfile = null;
let people = [];
let requestMap = new Map();
let connectionCounts = new Map();
let mutualCounts = new Map();

function showMessage(message, isError = false) {
  container.textContent = message;
  container.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function getSharedInterests(person) {
  const myInterests = (currentProfile?.interests || [])
    .map(item => item.toLowerCase());

  return (person.interests || []).filter(interest =>
    myInterests.includes(interest.toLowerCase())
  );
}

function createButton(label, action, options = {}) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = label;
  button.disabled = options.disabled || false;

  button.style.cssText = options.secondary
    ? "padding:11px 18px;border-radius:30px;" +
      "border:1px solid rgba(220,197,165,.4);" +
      "background:rgba(220,197,165,.09);" +
      "color:#f4eee4;font:600 12px 'DM Sans',sans-serif;" +
      "cursor:pointer;"
    : "padding:11px 18px;border-radius:30px;" +
      "border:1px solid rgba(220,197,165,.4);" +
      "background:linear-gradient(135deg,#ef3444,#b20b1b);" +
      "color:white;font:600 12px 'DM Sans',sans-serif;" +
      "cursor:pointer;";

  button.addEventListener("click", () => action(button));

  return button;
}

function getRequestStatus(personId) {
  return requestMap.get(personId) || null;
}

async function handleRequestAction(person, action, button) {
  button.disabled = true;
  button.textContent = "Please wait...";

  const request = getRequestStatus(person.id);

  let functionName;
  let argumentsObject;

  if (action === "send") {
    functionName = "ck_send_connection_request";
    argumentsObject = { target_user_id: person.id };

  } else if (action === "accept" && request) {
    functionName = "ck_accept_connection_request";
    argumentsObject = { request_id: request.id };

  } else if (action === "decline" && request) {
    functionName = "ck_decline_connection_request";
    argumentsObject = { request_id: request.id };

  } else if (action === "cancel" && request) {
    functionName = "ck_cancel_connection_request";
    argumentsObject = { request_id: request.id };

  } else {
    return;
  }

  const { error } = await supabase.rpc(
    functionName,
    argumentsObject
  );

  if (error) {
    console.error("Connection action failed:", error);

    alert(
      error.message ||
      "Something went wrong. Please try again."
    );

    await loadPeople();
    return;
  }

  await loadPeople();
}

function startMessage(person) {
  const recipient = encodeURIComponent(person.id);

  window.location.href = `/messages?to=${recipient}`;
}

function createPersonCard(person) {
  const card = document.createElement("article");

  card.className = "feature-card";
  card.style.cssText =
    "padding:22px;display:flex;flex-direction:column;gap:12px;";

  // Profile picture
  const avatar = document.createElement("div");

  avatar.style.cssText =
    "width:76px;height:76px;border-radius:50%;" +
    "background:#263d30;display:grid;place-items:center;" +
    "overflow:hidden;color:#f4eee4;font-size:25px;" +
    "font-weight:600;flex-shrink:0;";

  if (person.avatar_url) {
    const image = document.createElement("img");

    image.src = person.avatar_url;
    image.alt = `${person.display_name}'s profile picture`;

    image.style.cssText =
      "width:100%;height:100%;object-fit:cover;";

    avatar.append(image);
  } else {
    avatar.textContent =
      (person.display_name || "K").charAt(0).toUpperCase();
  }

  // Name
  const name = document.createElement("h3");
  name.textContent = person.display_name || "CONNECT-K member";
  name.style.margin = "0";

  // Username
  const username = document.createElement("p");
  username.className = "muted";
  username.style.margin = "0";
  username.textContent = `@${person.username}`;

  // Biography
  const bio = document.createElement("p");
  bio.style.cssText = "line-height:1.6;margin:0;";
  bio.textContent = person.bio || "A CONNECT-K member.";

  card.append(avatar, name, username, bio);

  // Institution
  if (person.institution) {
    const institution = document.createElement("p");

    institution.className = "muted";
    institution.style.margin = "0";
    institution.textContent = `⌂ ${person.institution}`;

    card.append(institution);
  }

  // Connection statistics
  // Only counts are shown, never connection identities.
  const stats = document.createElement("div");

  stats.style.cssText =
    "display:flex;gap:20px;flex-wrap:wrap;" +
    "padding:12px 0;" +
    "border-top:1px solid rgba(220,197,165,.15);" +
    "border-bottom:1px solid rgba(220,197,165,.15);";

  const connectionStat = document.createElement("span");

  connectionStat.style.cssText =
    "color:#dcc5a5;font-size:12px;";

  connectionStat.textContent =
    `${connectionCounts.get(person.id) ?? 0} connections`;

  const mutualStat = document.createElement("span");

  mutualStat.style.cssText =
    "color:#ed7b83;font-size:12px;";

  mutualStat.textContent =
    `${mutualCounts.get(person.id) ?? 0} mutual connections`;

  stats.append(connectionStat, mutualStat);
  card.append(stats);

  // Shared interests
  const shared = getSharedInterests(person);

  if (shared.length > 0) {
    const sharedTitle = document.createElement("p");

    sharedTitle.style.cssText =
      "color:#dcc5a5;font-size:13px;" +
      "font-weight:600;margin:5px 0 0;";

    sharedTitle.textContent = "Interests you share";

    const interestList = document.createElement("div");

    interestList.style.cssText =
      "display:flex;flex-wrap:wrap;gap:7px;";

    shared.forEach(interest => {
      const tag = document.createElement("span");

      tag.textContent = interest;

      tag.style.cssText =
        "padding:6px 10px;border-radius:20px;" +
        "background:rgba(220,197,165,0.12);" +
        "color:#dcc5a5;font-size:12px;";

      interestList.append(tag);
    });

    card.append(sharedTitle, interestList);

  } else if (person.interests?.length > 0) {
    const interestsTitle = document.createElement("p");

    interestsTitle.className = "muted";
    interestsTitle.style.cssText =
      "font-size:13px;margin:5px 0 0;";
    interestsTitle.textContent = "Interests";

    const interests = document.createElement("p");

    interests.className = "muted";
    interests.style.cssText = "font-size:13px;margin:0;";
    interests.textContent =
      person.interests.slice(0, 4).join(" · ");

    card.append(interestsTitle, interests);
  }

  // Connection and messaging actions
  const request = getRequestStatus(person.id);
  const actions = document.createElement("div");

  actions.style.cssText =
    "display:flex;gap:9px;flex-wrap:wrap;margin-top:5px;";

  if (request?.status === "accepted") {
    const connected = document.createElement("span");

    connected.textContent = "✓ Connected";

    connected.style.cssText =
      "color:#dcc5a5;font-size:13px;font-weight:600;" +
      "align-self:center;";

    actions.append(connected);

  } else if (
    request?.status === "pending" &&
    request.sender_id === currentUser.id
  ) {
    actions.append(
      createButton(
        "Request sent · Cancel",
        button => handleRequestAction(person, "cancel", button)
      )
    );

  } else if (
    request?.status === "pending" &&
    request.receiver_id === currentUser.id
  ) {
    actions.append(
      createButton(
        "Accept",
        button => handleRequestAction(person, "accept", button)
      ),
      createButton(
        "Decline",
        button => handleRequestAction(person, "decline", button),
        { secondary: true }
      )
    );

  } else {
    actions.append(
      createButton(
        "Connect",
        button => handleRequestAction(person, "send", button)
      )
    );
  }

  // Private messaging is available independently of connection status.
  actions.append(
    createButton(
      "Message",
      () => startMessage(person),
      { secondary: true }
    )
  );

  card.append(actions);

  return card;
}

function renderPeople() {
  const search = searchInput.value.trim().toLowerCase();

  const filteredPeople = people.filter(person => {
    const searchableText = [
      person.display_name,
      person.username,
      person.bio,
      person.institution,
      ...(person.interests || [])
    ].join(" ").toLowerCase();

    return searchableText.includes(search);
  });

  container.replaceChildren();

  if (filteredPeople.length === 0) {
    const empty = document.createElement("p");

    empty.className = "muted";

    empty.textContent = search
      ? "No people match your search. Try another name or interest."
      : "No other members have joined yet. Check back soon.";

    container.append(empty);
    return;
  }

  filteredPeople.forEach(person => {
    container.append(createPersonCard(person));
  });
}

async function loadPeople() {
  showMessage("Finding people in your community...");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, institution, interests"
    )
    .neq("id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    console.error("Discover error:", error);

    showMessage(
      "Could not load people: " + error.message,
      true
    );

    return;
  }

  people = data || [];

  // Load requests involving the signed-in user.
  const { data: requests, error: requestError } = await supabase
    .from("connection_requests")
    .select("id, sender_id, receiver_id, status, created_at")
    .or(
      `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
    );

  if (requestError) {
    console.error("Request loading error:", requestError);

    showMessage(
      "Could not load connection requests: " +
      requestError.message,
      true
    );

    return;
  }

  requestMap = new Map();

  (requests || []).forEach(request => {
    const otherUserId =
      request.sender_id === currentUser.id
        ? request.receiver_id
        : request.sender_id;

    const existing = requestMap.get(otherUserId);

    const priority = {
      accepted: 3,
      pending: 2,
      declined: 1
    };

    if (
      !existing ||
      priority[request.status] > priority[existing.status]
    ) {
      requestMap.set(otherUserId, request);
    }
  });

  // Load numerical counts only.
  connectionCounts = new Map();
  mutualCounts = new Map();

  const countResults = await Promise.all(
    people.map(async person => {
      const [connections, mutuals] = await Promise.all([
        supabase.rpc("ck_connection_count", {
          target_user_id: person.id
        }),

        supabase.rpc("ck_mutual_connection_count", {
          target_user_id: person.id
        })
      ]);

      if (connections.error) {
        console.error("Connection count error:", connections.error);
      }

      if (mutuals.error) {
        console.error("Mutual count error:", mutuals.error);
      }

      return {
        id: person.id,
        connections: connections.error
          ? 0
          : Number(connections.data || 0),
        mutuals: mutuals.error
          ? 0
          : Number(mutuals.data || 0)
      };
    })
  );

  countResults.forEach(result => {
    connectionCounts.set(result.id, result.connections);
    mutualCounts.set(result.id, result.mutuals);
  });

  renderPeople();
}

async function initializeDiscover() {
  if (!isSupabaseConfigured || !supabase) {
    location.href = "/login";
    return;
  }

  const { data: { session }, error } =
    await supabase.auth.getSession();

  if (error || !session) {
    location.href = "/login";
    return;
  }

  currentUser = session.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, interests")
    .eq("id", currentUser.id)
    .single();

  if (profileError) {
    console.error("Your profile could not be loaded:", profileError);

    showMessage(
      "Could not load your profile information.",
      true
    );

    return;
  }

  currentProfile = profile;

  await loadPeople();
}

// Search
searchInput.addEventListener("input", renderPeople);

// Logout
logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

// Start Discover
initializeDiscover();