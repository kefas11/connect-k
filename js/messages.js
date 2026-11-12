import { supabase, isSupabaseConfigured } from "./supabase.js";

const $ = (selector) => document.querySelector(selector);

const conversationsContainer = $("#conversations-container");
const requestsContainer = $("#requests-container");
const messagesContainer = $("#messages-container");
const chatTitle = $("#chat-title");
const messageForm = $("#message-form");
const messageInput = $("#message-input");
const sendButton = $("#send-message-button");
const messageStatus = $("#message-status");
const logoutButton = $("#logout-button");

let currentUser = null;
let conversations = [];
let selectedConversationId = null;
let selectedRecipientId = null;
let loadingConversations = false;

function showStatus(message, isError = false) {
  messageStatus.textContent = message;
  messageStatus.style.color = isError ? "#ff7880" : "#dcc5a5";
}

function makeButton(label, action, className = "btn btn-ghost") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function getOtherMember(conversation) {
  return (conversation.conversation_members || []).find(
    member => member.user_id !== currentUser.id
  );
}

function getOtherName(conversation) {
  return getOtherMember(conversation)?.profile?.display_name
    || "CONNECT-K member";
}

function renderEmpty(container, message) {
  const paragraph = document.createElement("p");
  paragraph.className = "muted";
  paragraph.textContent = message;
  container.replaceChildren(paragraph);
}

function renderConversationList(items, container, isRequest = false) {
  container.replaceChildren();

  if (!items.length) {
    renderEmpty(
      container,
      isRequest
        ? "You have no message requests."
        : "No conversations yet. Visit Discover to meet people."
    );
    return;
  }

  items.forEach(conversation => {
    const card = document.createElement("article");
    card.className = "feature-card";
    card.style.cssText =
      "padding:16px;margin-bottom:12px;display:flex;" +
      "align-items:center;justify-content:space-between;" +
      "gap:12px;flex-wrap:wrap;";

    const details = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = getOtherName(conversation);

    const preview = document.createElement("p");
    preview.className = "muted";
    preview.style.margin = "5px 0 0";

    const latestMessage = conversation.messages?.[0];

    preview.textContent = latestMessage
      ? latestMessage.body.slice(0, 75)
      : "Start a conversation";

    details.append(name, preview);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

    if (isRequest) {
      actions.append(
        makeButton(
          "Accept",
          () => acceptRequest(conversation.id),
          "btn btn-red"
        ),
        makeButton(
          "Decline",
          () => declineRequest(conversation.id)
        )
      );
    } else {
      actions.append(
        makeButton(
          "Open chat",
          () => openConversation(conversation)
        )
      );
    }

    card.append(details, actions);
    container.append(card);
  });
}

function renderConversationSections() {
  const inbox = conversations.filter(
    conversation => conversation.request_status === "accepted"
  );

  const requests = conversations.filter(
    conversation =>
      conversation.request_status === "pending" &&
      conversation.created_by !== currentUser.id
  );

  renderConversationList(inbox, conversationsContainer);
  renderConversationList(requests, requestsContainer, true);
}

async function loadConversations() {
  if (loadingConversations) return;

  loadingConversations = true;

  try {
    const { data: memberships, error: membershipError } =
      await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUser.id);

    if (membershipError) throw membershipError;

    const conversationIds = [
      ...new Set(
        (memberships || []).map(item => item.conversation_id)
      )
    ];

    if (!conversationIds.length) {
      conversations = [];
      renderConversationSections();
      return;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        conversation_type,
        request_status,
        created_by,
        created_at,
        conversation_members (
          user_id
        ),
        messages (
          id,
          sender_id,
          body,
          created_at
        )
      `)
      .in("id", conversationIds)
      .eq("conversation_type", "direct")
      .order("created_at", { ascending: false });

    if (error) throw error;

    conversations = data || [];

    const otherUserIds = [
      ...new Set(
        conversations.flatMap(conversation =>
          (conversation.conversation_members || [])
            .map(member => member.user_id)
            .filter(id => id !== currentUser.id)
        )
      )
    ];

    let profileMap = new Map();

    if (otherUserIds.length) {
      const { data: profiles, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", otherUserIds);

      if (profileError) throw profileError;

      profileMap = new Map(
        (profiles || []).map(profile => [profile.id, profile])
      );
    }

    conversations.forEach(conversation => {
      conversation.conversation_members =
        (conversation.conversation_members || []).map(member => ({
          ...member,
          profile: profileMap.get(member.user_id) || null
        }));

      conversation.messages = (conversation.messages || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    });

    renderConversationSections();

  } catch (error) {
    console.error("Conversation loading failed:", error);

    renderEmpty(
      conversationsContainer,
      "Could not load conversations: " + error.message
    );

    renderEmpty(
      requestsContainer,
      "Could not load message requests."
    );

  } finally {
    loadingConversations = false;
  }
}

async function acceptRequest(conversationId) {
  try {
    const { error } = await supabase.rpc(
      "ck_accept_message_request",
      { target_conversation_id: conversationId }
    );

    if (error) throw error;

    showStatus("Message request accepted.");
    await loadConversations();

    const acceptedConversation = conversations.find(
      conversation => conversation.id === conversationId
    );

    if (acceptedConversation) {
      await openConversation(acceptedConversation);
    }

  } catch (error) {
    console.error("Accept request failed:", error);
    showStatus(error.message, true);
  }
}

async function declineRequest(conversationId) {
  try {
    const { error } = await supabase.rpc(
      "ck_decline_message_request",
      { target_conversation_id: conversationId }
    );

    if (error) throw error;

    showStatus("Message request declined.");
    await loadConversations();

  } catch (error) {
    console.error("Decline request failed:", error);
    showStatus(error.message, true);
  }
}

async function openConversation(conversation) {
  const otherMember = getOtherMember(conversation);

  if (!otherMember) {
    showStatus("This conversation could not be opened.", true);
    return;
  }

  selectedConversationId = conversation.id;
  selectedRecipientId = otherMember.user_id;

  chatTitle.textContent = getOtherName(conversation);
  messageInput.disabled = false;
  sendButton.disabled = false;

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) {
    showStatus("Could not load messages: " + error.message, true);
    return;
  }

  messagesContainer.replaceChildren();

  if (!data?.length) {
    renderEmpty(messagesContainer, "No messages yet. Say hello!");
    return;
  }

  data.forEach(message => {
    const bubble = document.createElement("div");

    bubble.style.cssText =
      "max-width:85%;width:fit-content;padding:12px 16px;" +
      "border-radius:15px;margin:10px 0;line-height:1.5;" +
      "overflow-wrap:anywhere;";

    const isMine = message.sender_id === currentUser.id;

    bubble.style.marginLeft = isMine ? "auto" : "0";
    bubble.style.background = isMine
      ? "linear-gradient(135deg,#ef3444,#b20b1b)"
      : "rgba(220,197,165,.12)";

    const body = document.createElement("p");
    body.textContent = message.body;
    body.style.margin = "0";

    const time = document.createElement("small");
    time.textContent = new Date(message.created_at).toLocaleString();
    time.style.opacity = ".7";

    bubble.append(body, time);
    messagesContainer.append(bubble);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const body = messageInput.value.trim();

  if (!body || !selectedRecipientId) {
    showStatus("Choose a conversation first.", true);
    return;
  }

  sendButton.disabled = true;
  sendButton.textContent = "Sending...";

  try {
    const { error } = await supabase.rpc(
      "ck_send_direct_message",
      {
        target_user_id: selectedRecipientId,
        message_body: body
      }
    );

    if (error) throw error;

    messageInput.value = "";
    showStatus("Message sent.");

    await loadConversations();

    const updatedConversation = conversations.find(
      conversation => conversation.id === selectedConversationId
    );

    if (updatedConversation) {
      await openConversation(updatedConversation);
    }

  } catch (error) {
    console.error("Message sending failed:", error);
    showStatus(error.message, true);

  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send message";
  }
});

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
});

async function initializeMessages() {
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

  await loadConversations();
}

initializeMessages();