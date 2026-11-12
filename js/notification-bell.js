import { supabase, isSupabaseConfigured } from "./supabase.js";
function createNotificationBell(mobile = false) {
  const link = document.createElement("a");
  link.href = "/notifications";
  link.className = mobile
    ? "mobile-nav-item notification-bell-mobile"
    : "notification-bell-link";
  link.setAttribute("aria-label", "Notifications");
  link.title = "Notifications";
  link.style.position = "relative";
  link.style.display = "inline-flex";
  link.style.alignItems = "center";
  link.style.justifyContent = "center";
  link.style.gap = "6px";
  link.style.textDecoration = "none";
  link.style.color = "#F0C5CE";
  link.style.fontSize = mobile ? "12px" : "20px";
  link.style.fontWeight = "600";
  link.style.cursor = "pointer";
  const icon = document.createElement("span");
  icon.textContent = "🔔";
  if (mobile) {
    icon.className = "mobile-nav-icon";
    const label = document.createElement("span");
    label.textContent = "Alerts";
    link.append(icon, label);
  } else {
    icon.className = "notification-bell-icon";
    link.append(icon);
  }
  const badge = document.createElement("span");
  badge.className = "notification-bell-count";
  badge.textContent = "0";
  badge.hidden = true;
  badge.style.position = "absolute";
  badge.style.top = "-7px";
  badge.style.right = "-10px";
  badge.style.background = "#C02B43";
  badge.style.color = "#FFF8F0";
  badge.style.fontSize = "10px";
  badge.style.fontWeight = "700";
  badge.style.padding = "2px 6px";
  badge.style.borderRadius = "20px";
  badge.style.minWidth = "17px";
  badge.style.textAlign = "center";
  link.append(badge);
  return { link, badge };
}
async function initializeNotificationBell() {
  const desktopNav = document.querySelector(".nav-links");
  const mobileNav = document.querySelector(".mobile-nav");
  let desktopBell = null;
  let mobileBell = null;
  // Display the bell immediately.
  if (desktopNav) {
    desktopBell = createNotificationBell(false);
    if (!desktopNav.querySelector(".notification-bell-link")) {
      desktopNav.append(desktopBell.link);
    } else {
      desktopBell = null;
    }
  }
  if (mobileNav) {
    mobileBell = createNotificationBell(true);
    if (!mobileNav.querySelector(".notification-bell-mobile")) {
      mobileNav.append(mobileBell.link);
    } else {
      mobileBell = null;
    }
  }
  // Load the unread count separately.
  if (!isSupabaseConfigured || !supabase) {
    console.warn("Notification count unavailable: Supabase is not configured.");
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.warn("No active session for notification count.");
      return;
    }
    const userId = data.session.user.id;
    async function updateCount() {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (error) {
        console.error("Notification count failed:", error);
        return;
      }
      const value = count || 0;
      [desktopBell?.badge, mobileBell?.badge].forEach(badge => {
        if (!badge) return;
        badge.textContent = value > 99 ? "99+" : String(value);
        badge.hidden = value === 0;
      });
    }
    await updateCount();
    const channel = supabase
      .channel(`notification-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`
        },
        updateCount
      )
      .subscribe();
    window.addEventListener("pagehide", () => {
      supabase.removeChannel(channel);
    });
  } catch (error) {
    console.error("Notification bell error:", error);
  }
}
initializeNotificationBell();