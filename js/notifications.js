import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const list = $("#notifications-list");
const unreadCount = $("#unread-count");
const markAllButton = $("#mark-all-read");
const status = $("#notification-status");
const logoutButton = $("#logout-button");

let currentUser = null;
let notifications = [];

function showStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function getIcon(type) {
  const icons = {
    connection_request: "♧",
    connection_accepted: "✓",
    new_message: "✉",
    post_like: "♥",
    community_update: "◎",
    system: "✦"
  };

  return icons[type] || "✦";
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function updateUnreadCount() {
  const count = notifications.filter(item => !item.read_at).length;

  unreadCount.textContent =
    `${count} unread`;

  markAllButton.disabled = count === 0;
}

function createButton(label, action, className = "btn btn-ghost") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function renderNotifications() {
  list.replaceChildren();

  updateUnreadCount();

  if (!notifications.length) {
    const empty = document.createElement("div");
    empty.style.cssText =
      "text-align:center;padding:45px 15px;";

    const icon = document.createElement("div");
    icon.textContent = "✦";
    icon.style.cssText =
      "font-size:36px;color:#e3b2bf;margin-bottom:12px;";

    const heading = document.createElement("h3");
    heading.textContent = "You're all caught up.";
    heading.style.color = "#f4ebdd";

    const description = document.createElement("p");
    description.className = "muted";
    description.textContent =
      "When something important happens, you'll find it here.";

    empty.append(icon, heading, description);
    list.append(empty);
    return;
  }

  notifications.forEach(notification => {
    const card = document.createElement("article");

    card.style.cssText = `
      display:flex;
      align-items:flex-start;
      gap:14px;
      padding:17px;
      margin-bottom:12px;
      border-radius:17px;
      background:${
        notification.read_at
          ? "rgba(255,255,255,.035)"
          : "rgba(192,43,67,.12)"
      };
      border:1px solid ${
        notification.read_at
          ? "rgba(220,197,165,.14)"
          : "rgba(192,43,67,.38)"
      };
    `;

    const icon = document.createElement("div");
    icon.textContent = getIcon(notification.notification_type);
    icon.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      width:44px;
      height:44px;
      border-radius:50%;
      background:linear-gradient(135deg,#7137A8,#552582);
      color:#fff8f0;
      font-size:21px;
    `;

    const content = document.createElement("div");
    content.style.cssText = "flex:1;min-width:0;";

    const headingRow = document.createElement("div");
    headingRow.style.cssText =
      "display:flex;align-items:center;gap:9px;flex-wrap:wrap;";

    const title = document.createElement("strong");
    title.textContent = notification.title;
    title.style.color = "#f4ebdd";

    headingRow.append(title);

    if (!notification.read_at) {
      const badge = document.createElement("span");
      badge.textContent = "NEW";
      badge.style.cssText = `
        padding:4px 9px;
        border-radius:999px;
        background:#C02B43;
        color:#fff8f0;
        font-size:10px;
        font-weight:800;
        letter-spacing:.5px;
      `;
      headingRow.append(badge);
    }

    const body = document.createElement("p");
    body.textContent = notification.body || "";
    body.style.cssText =
      "color:#d6dfd6;margin:7px 0;font-size:14px;";

    const time = document.createElement("small");
    time.textContent = formatTime(notification.created_at);
    time.style.cssText = "color:#dcc5a5;font-size:11px;";

    const actions = document.createElement("div");
    actions.style.cssText =
      "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;";

    const openButton = createButton(
      "View",
      () => openNotification(notification),
      "btn btn-red"
    );

    openButton.style.cssText =
      "padding:8px 17px;font-size:12px;";

    const deleteButton = createButton(
      "Delete",
      () => deleteNotification(notification.id)
    );

    deleteButton.style.cssText =
      "padding:8px 15px;font-size:12px;";

    actions.append(openButton, deleteButton);

    content.append(headingRow, body, time, actions);
    card.append(icon, content);
    list.append(card);
  });
}

async function loadNotifications() {
  list.textContent = "Loading your notifications...";

  try {
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        actor_id,
        notification_type,
        title,
        body,
        target_url,
        related_id,
        read_at,
        created_at
      `)
      .eq("recipient_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    notifications = data || [];
    renderNotifications();

  } catch (error) {
    console.error("Notification loading failed:", error);
    list.textContent = "Could not load notifications.";
    showStatus(error.message, true);
  }
}

async function markAsRead(notificationId) {
  const notification = notifications.find(
    item => item.id === notificationId
  );

  if (!notification || notification.read_at) return;

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id, read_at")
    .maybeSingle();

  if (error) throw error;

  if (data) {
    notification.read_at = data.read_at;
    updateUnreadCount();
  }
}

async function openNotification(notification) {
  try {
    await markAsRead(notification.id);
    renderNotifications();

    const destination = notification.target_url || "/notifications";

    // Only allow internal CONNECT-K routes.
    if (
      !destination.startsWith("/") ||
      destination.startsWith("//") ||
      destination.includes("\\")
    ) {
      showStatus("This notification has an invalid destination.", true);
      return;
    }

    window.location.href = destination;

  } catch (error) {
    console.error("Could not open notification:", error);
    showStatus("Could not update notification: " + error.message, true);
  }
}

async function markAllAsRead() {
  if (!notifications.some(item => !item.read_at)) return;

  markAllButton.disabled = true;
  markAllButton.textContent = "Updating...";

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", currentUser.id)
      .is("read_at", null);

    if (error) throw error;

    notifications.forEach(item => {
      if (!item.read_at) {
        item.read_at = new Date().toISOString();
      }
    });

    renderNotifications();
    showStatus("All notifications marked as read.");

  } catch (error) {
    console.error("Mark all as read failed:", error);
    showStatus(error.message, true);

  } finally {
    markAllButton.textContent = "Mark all as read";
    updateUnreadCount();
  }
}

async function deleteNotification(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) throw error;

    notifications = notifications.filter(
      item => item.id !== notificationId
    );

    renderNotifications();
    showStatus("Notification deleted.");

  } catch (error) {
    console.error("Notification deletion failed:", error);
    showStatus(error.message, true);
  }
}

markAllButton.addEventListener("click", markAllAsRead);

logoutButton?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
});

async function initializeNotifications() {
  if (!isSupabaseConfigured || !supabase) {
    window.location.href = "/login";
    return;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "/login";
    return;
  }

  currentUser = data.session.user;

  await loadNotifications();
}

initializeNotifications();