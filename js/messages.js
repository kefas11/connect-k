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

// Count incoming messages received after this member last read the chat.
function getUnreadCount(conversation) {
  const myMembership = (conversation.conversation_members || []).find(
    member => member.user_id === currentUser.id
  );

  const lastReadAt = myMembership?.last_read_at
    ? new Date(myMembership.last_read_at).getTime()
    : 0;

  return (conversation.messages || []).filter(message => {
    return (
      message.sender_id !== currentUser.id &&
      new Date(message.created_at).getTime() > lastReadAt
    );
  }).length;
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
    details.style.cssText = "flex:1;min-width:150px;";

    const nameRow = document.createElement("div");
    nameRow.style.cssText =
      "display:flex;align-items:center;gap:9px;flex-wrap:wrap;";

    const name = document.createElement("strong");
    name.textContent = getOtherName(conversation);
    nameRow.append(name);

    const unreadCount = isRequest ? 0 : getUnreadCount(conversation);

    if (unreadCount > 0) {
      const badge = document.createElement("span");
      badge.textContent = unreadCount === 1
        ? "UNREAD · 1"
        : `UNREAD · ${unreadCount}`;

      badge.style.cssText =
        "display:inline-flex;align-items:center;" +
        "padding:5px 10px;border-radius:999px;" +
        "background:linear-gradient(135deg,#F0B7C5,#DF8FA5);" +
        "color:#173626;font-size:10px;font-weight:800;" +
        "letter-spacing:.5px;";

      nameRow.append(badge);
    }

    const preview = document.createElement("p");
    preview.className = "muted";
    preview.style.margin = "5px 0 0";

    const latestMessage = conversation.messages?.[0];

    preview.textContent = latestMessage
      ? latestMessage.body.slice(0, 75)
      : "Start a conversation";

    details.append(nameRow, preview);

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
          user_id,
          last_read_at
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

function enableComposer(recipientId, recipientName) {
  selectedConversationId = null;
  selectedRecipientId = recipientId;

  chatTitle.textContent = `Message ${recipientName}`;

  messageInput.disabled = false;
  sendButton.disabled = false;

  renderEmpty(
    messagesContainer,
    "Start a private conversation with this member."
  );

  messageInput.focus();
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

  // Mark this conversation as read for the current user.
  const { error: readError } = await supabase.rpc(
    "ck_mark_conversation_read",
    { target_conversation_id: conversation.id }
  );

  if (readError) {
    console.error("Could not mark conversation as read:", readError);
    showStatus("Could not update read status: " + readError.message, true);
    return;
  }

  // Update local state so the unread badge disappears immediately.
  const myMembership = (conversation.conversation_members || []).find(
    member => member.user_id === currentUser.id
  );

  if (myMembership) {
    myMembership.last_read_at = new Date().toISOString();
  }

  renderConversationSections();

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

    const isMine = message.sender_id === currentUser.id;

    bubble.style.cssText =
      "max-width:82%;width:fit-content;" +
      "padding:13px 17px;" +
      "border-radius:18px;" +
      "margin:12px 0;" +
      "line-height:1.6;" +
      "overflow-wrap:anywhere;" +
      "box-shadow:0 5px 15px rgba(0,0,0,.16);" +
      "border:1px solid rgba(255,255,255,.12);";

    bubble.style.marginLeft = isMine ? "auto" : "0";
    bubble.style.marginRight = isMine ? "0" : "auto";

    // Your messages: Royal purple.
    // Received messages: Crimson red.
    bubble.style.background = isMine
      ? "linear-gradient(135deg,#8148B8,#552582)"
      : "linear-gradient(135deg,#C02B43,#86182D)";

    const body = document.createElement("p");
    body.textContent = message.body;
    body.style.cssText =
      "margin:0;color:#fff8f0;font-size:14px;";

    const time = document.createElement("small");
    time.textContent = new Date(message.created_at).toLocaleString();
    time.style.cssText =
      "display:block;margin-top:7px;color:#f1d9e5;" +
      "font-size:10px;opacity:.9;";

    bubble.append(body, time);
    messagesContainer.append(bubble);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function openRecipientFromDiscover() {
  const params = new URLSearchParams(window.location.search);
  const recipientId = params.get("to");

  if (!recipientId) return;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    recipientId === currentUser.id ||
    !uuidPattern.test(recipientId)
  ) {
    showStatus("Invalid message recipient.", true);
    return;
  }

  const { data: recipient, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", recipientId)
    .maybeSingle();

  if (error || !recipient) {
    showStatus("We could not find this member's profile.", true);
    return;
  }

  const existingConversation = conversations.find(conversation =>
    (conversation.conversation_members || []).some(
      member => member.user_id === recipientId
    )
  );

  if (existingConversation?.request_status === "accepted") {
    await openConversation(existingConversation);
    return;
  }

  if (existingConversation?.request_status === "pending") {
    selectedRecipientId = null;
    messageInput.disabled = true;
    sendButton.disabled = true;

    if (existingConversation.created_by === currentUser.id) {
      chatTitle.textContent = `Request sent to ${recipient.display_name}`;

      renderEmpty(
        messagesContainer,
        "Your message request is waiting for a response."
      );

      showStatus("You can continue chatting after they accept.");

    } else {
      chatTitle.textContent = `Request from ${recipient.display_name}`;

      renderEmpty(
        messagesContainer,
        "Please accept or decline this request in the Message Requests section."
      );
    }

    return;
  }

  enableComposer(recipient.id, recipient.display_name);
}

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const body = messageInput.value.trim();

  if (!body || !selectedRecipientId) {
    showStatus("Choose a valid conversation first.", true);
    return;
  }

  sendButton.disabled = true;
  sendButton.textContent = "Sending...";

  try {
    const { data: conversationId, error } = await supabase.rpc(
      "ck_send_direct_message",
      {
        target_user_id: selectedRecipientId,
        message_body: body
      }
    );

    if (error) throw error;

    messageInput.value = "";
    selectedConversationId = conversationId;

    await loadConversations();

    const updatedConversation = conversations.find(
      conversation => conversation.id === conversationId
    );

    if (updatedConversation?.request_status === "accepted") {
      await openConversation(updatedConversation);
      showStatus("Message sent.");

    } else {
      selectedRecipientId = null;
      messageInput.disabled = true;
      sendButton.disabled = true;

      chatTitle.textContent = "Message request sent";

      renderEmpty(
        messagesContainer,
        "Your first message has been sent. You can continue chatting after the recipient accepts your request."
      );

      showStatus("Your message request is awaiting acceptance.");
    }

  } catch (error) {
    console.error("Message sending failed:", error);
    showStatus(error.message, true);

  } finally {
    sendButton.textContent = "Send message";
    sendButton.disabled = !selectedRecipientId;
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
  await openRecipientFromDiscover();
}

initializeMessages();