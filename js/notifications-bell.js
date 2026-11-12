import { supabase, isSupabaseConfigured } from "./supabase.js";

async function initializeNotificationBell() {
  if (!isSupabaseConfigured || !supabase) return;

  const { data: sessionData, error } =
    await supabase.auth.getSession();

  if (error || !sessionData.session) return;

  const userId = sessionData.session.user.id;
  const desktopNav = document.querySelector(".nav-links");
  const mobileNav = document.querySelector(".mobile-nav");

  function createBell(mobile = false) {
    const link = document.createElement("a");
    link.href = "/notifications";
    link.className = mobile
      ? "mobile-nav-item notification-bell-mobile"
      : "notification-bell-link";

    link.setAttribute("aria-label", "Notifications");

    const icon = document.createElement("span");
    icon.textContent = "♧";

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
    badge.hidden = true;
    link.append(badge);

    return { link, badge };
  }

  let desktopBell = null;
  let mobileBell = null;

  if (desktopNav && !desktopNav.querySelector(".notification-bell-link")) {
    desktopBell = createBell(false);
    desktopNav.append(desktopBell.link);
  }

  if (mobileNav && !mobileNav.querySelector(".notification-bell-mobile")) {
    mobileBell = createBell(true);
    mobileNav.append(mobileBell.link);
  }

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
      () => updateCount()
    )
    .subscribe();

  window.addEventListener("pagehide", () => {
    supabase.removeChannel(channel);
  });
}

initializeNotificationBell();