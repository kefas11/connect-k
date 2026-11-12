import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const container = $("#discover-container");
const searchInput = $("#discover-search");
const logoutButton = $("#logout-button");

let currentUser = null;
let currentProfile = null;
let people = [];

function showMessage(text, isError = false) {
  container.textContent = text;
  container.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function getSharedInterests(person) {
  const myInterests = (currentProfile?.interests || [])
    .map(item => item.toLowerCase());

  return (person.interests || []).filter(interest =>
    myInterests.includes(interest.toLowerCase())
  );
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

  // Institution
  const institution = document.createElement("p");
  institution.className = "muted";
  institution.style.margin = "0";

  if (person.institution) {
    institution.textContent = `⌂ ${person.institution}`;
  }

  card.append(avatar, name, username, bio);

  if (person.institution) {
    card.append(institution);
  }

  // Shared interests
  const shared = getSharedInterests(person);

  if (shared.length > 0) {
    const sharedTitle = document.createElement("p");
    sharedTitle.style.cssText =
      "color:#dcc5a5;font-size:13px;font-weight:600;margin:5px 0 0;";
    sharedTitle.textContent = "Interests you share";

    card.append(sharedTitle);

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

    card.append(interestList);
  } else if (person.interests?.length > 0) {
    const interestsTitle = document.createElement("p");
    interestsTitle.className = "muted";
    interestsTitle.style.cssText =
      "font-size:13px;margin:5px 0 0;";
    interestsTitle.textContent = "Interests";

    const interests = document.createElement("p");
    interests.className = "muted";
    interests.style.cssText = "font-size:13px;margin:0;";
    interests.textContent = person.interests.slice(0, 4).join(" · ");

    card.append(interestsTitle, interests);
  }

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
    showMessage("Could not load your profile information.", true);
    return;
  }

  currentProfile = profile;

  await loadPeople();
}

searchInput.addEventListener("input", renderPeople);

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "/";
});

initializeDiscover();