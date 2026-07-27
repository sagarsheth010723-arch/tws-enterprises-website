import { bindLogout, protectPage } from "./guard.js";
import { renderShell, showToast } from "./components.js";
import { TelegramApiService } from "../modules/telegram/services/telegram-api-service.js";

const api = new TelegramApiService();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));

function apiError(error) {
  const messages = {
    "functions/permission-denied": "Director access is required.",
    "functions/failed-precondition": "Configure and verify the Telegram bot first.",
    "functions/invalid-argument": "Please review the supplied value and try again.",
    "functions/not-found": "The requested Telegram channel was not found.",
    "functions/resource-exhausted": "Telegram rate limit reached. Try again shortly."
  };
  return messages[error.code] || error.message || "The Telegram request could not be completed.";
}

function channelRows(channels) {
  if (!channels.length) return '<tr><td colspan="4">No Telegram channels have been connected.</td></tr>';
  return channels.map((channel) => `<tr><td><b>${escapeHtml(channel.title || channel.channelId)}</b><small>${escapeHtml(channel.username ? "@" + channel.username : channel.channelId)}</small></td><td><span class="channel-status ${channel.verified ? "verified" : "pending"}">${channel.verified ? "Verified" : "Needs verification"}</span></td><td>${escapeHtml(channel.type || "Channel")}</td><td><div class="table-actions"><button data-verify-channel="${escapeHtml(channel.channelId)}" type="button">Verify</button><button data-delete-channel="${escapeHtml(channel.channelId)}" type="button">Delete</button></div></td></tr>`).join("");
}

function bindChannelActions(refresh) {
  document.querySelectorAll("[data-verify-channel]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try { const result = await api.verifyChannel(button.dataset.verifyChannel); showToast(result.message || "Channel verified."); await refresh(); }
    catch (error) { showToast(apiError(error), "error"); } finally { button.disabled = false; }
  }));
  document.querySelectorAll("[data-delete-channel]").forEach((button) => button.addEventListener("click", async () => {
    const channelId = button.dataset.deleteChannel;
    if (!window.confirm(`Remove ${channelId} from Telegram channel management?`)) return;
    button.disabled = true;
    try { await api.deleteChannel(channelId); showToast("Channel removed."); await refresh(); }
    catch (error) { showToast(apiError(error), "error"); } finally { button.disabled = false; }
  }));
}

protectPage(async ({ user }) => {
  let status;
  let channels = [];
  let telegramSettings = { notificationsEnabled: true };
  try {
    [status, channels, telegramSettings] = await Promise.all([api.getStatus(), api.listChannels(), api.getSettings()]);
  } catch (error) {
    status = { configured: false, bot: null, serviceError: apiError(error) };
  }

  const render = () => {
    const botName = status.bot?.username ? `@${escapeHtml(status.bot.username)}` : "Not configured";
    const botState = status.configured ? "Verified bot" : "Bot setup required";
    renderShell({ activePage: "telegram", user, content: `
      <section class="page-title"><div><p class="eyebrow">TELEGRAM OPERATIONS</p><h1>Connected <span>communications.</span></h1><p>Configure the bot securely, manage approved channels, and validate delivery.</p></div><div class="session-badge"><span class="status-dot"></span><span>${status.configured ? "Bot verified" : "Setup required"}</span></div></section>
      <section class="telegram-summary">
        <article class="telegram-hero glass-card"><div><p class="eyebrow">BOT STATUS</p><h2>${botState}</h2><p>${status.configured ? `Connected as ${botName}. All Telegram calls are performed by trusted Firebase functions.` : "Enter a bot token to validate the integration through the protected server-side gateway."}</p></div><span class="telegram-bot-mark">TG</span></article>
        <article class="metric-card glass-card"><div class="metric-icon teal">TG</div><div><span>Connected channels</span><strong>${channels.length}</strong><small>Approved destinations</small></div></article>
      </section>
      <section class="telegram-grid">
        <article class="settings-card glass-card"><p class="eyebrow">BOT CONFIGURATION</p><h2>Verify Telegram bot</h2><p>Tokens are sent only to the secured callable function, encrypted, and never returned to this browser.</p><form class="settings-form" id="botForm"><label>Bot token<input name="token" type="password" autocomplete="off" placeholder="123456789:AA..." required minlength="20"></label><div class="form-actions"><button class="secondary-button" type="submit">${status.configured ? "Replace and verify token" : "Verify and save token"}</button></div></form>${status.serviceError ? `<p class="form-error">${escapeHtml(status.serviceError)}</p>` : ""}</article>
        <article class="settings-card glass-card"><p class="eyebrow">TELEGRAM SETTINGS</p><h2>Delivery preferences</h2><div class="preference-row"><span><b>Delivery notifications</b><small>Track channel message delivery events.</small></span><label class="switch"><input id="notificationsEnabled" type="checkbox" ${telegramSettings.notificationsEnabled !== false ? "checked" : ""}><span></span></label></div><p>Settings are stored in the protected Telegram configuration document.</p></article>
      </section>
      <section class="telegram-grid">
        <article class="settings-card glass-card"><p class="eyebrow">CHANNEL MANAGEMENT</p><h2>Add channel</h2><p>Add a Telegram channel ID or public channel handle. The bot must already be a channel administrator to verify and send messages.</p><form class="settings-form" id="channelForm"><label>Channel ID or handle<input name="channelId" placeholder="@channel_handle or -100..." required maxlength="100"></label><div class="form-actions"><button class="secondary-button" type="submit">Add and verify channel</button></div></form></article>
        <article class="settings-card glass-card"><p class="eyebrow">TEST DELIVERY</p><h2>Send test message</h2><p>Select an approved channel and send a live test through the configured bot.</p><form class="settings-form" id="testMessageForm"><label>Channel<select name="channelId" required><option value="">Select a verified channel</option>${channels.filter((channel) => channel.verified).map((channel) => `<option value="${escapeHtml(channel.channelId)}">${escapeHtml(channel.title || channel.channelId)}</option>`).join("")}</select></label><label>Message<textarea name="message" maxlength="4096" required>TWS Secure Panel test message.</textarea></label><div class="form-actions"><button class="secondary-button" type="submit">Send test message</button></div></form></article>
      </section>
      <section class="session-card glass-card"><div class="card-heading"><div><p class="eyebrow">MANAGED CHANNELS</p><h2>Channel directory</h2></div><button class="secondary-button" id="refreshChannels" type="button">Refresh channels</button></div><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th>Type</th><th>Actions</th></tr></thead><tbody id="channelTableBody">${channelRows(channels)}</tbody></table></div></section>` });
    bindLogout();
    bindForms();
    bindChannelActions(refresh);
  };

  const refresh = async () => {
    try { channels = await api.listChannels(); document.querySelector("#channelTableBody").innerHTML = channelRows(channels); bindChannelActions(refresh); }
    catch (error) { showToast(apiError(error), "error"); }
  };

  const bindForms = () => {
    document.querySelector("#botForm").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); button.disabled = true;
      try { status = await api.configureBot(new FormData(form).get("token")); form.reset(); showToast("Bot verified and token stored securely."); render(); }
      catch (error) { showToast(apiError(error), "error"); } finally { button.disabled = false; }
    });
    document.querySelector("#channelForm").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); button.disabled = true;
      try { const result = await api.addChannel(new FormData(form).get("channelId")); form.reset(); showToast(result.message || "Channel added and verified."); await refresh(); }
      catch (error) { showToast(apiError(error), "error"); } finally { button.disabled = false; }
    });
    document.querySelector("#testMessageForm").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); button.disabled = true;
      try { const values = new FormData(form); const result = await api.sendTestMessage(values.get("channelId"), values.get("message")); showToast(result.message || "Test message sent."); }
      catch (error) { showToast(apiError(error), "error"); } finally { button.disabled = false; }
    });
    document.querySelector("#notificationsEnabled").addEventListener("change", async (event) => {
      try { telegramSettings = await api.updateSettings({ notificationsEnabled: event.target.checked }); showToast("Telegram preferences saved."); }
      catch (error) { event.target.checked = !event.target.checked; showToast(apiError(error), "error"); }
    });
    document.querySelector("#refreshChannels").addEventListener("click", refresh);
  };
  render();
});
