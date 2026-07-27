import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import { app, auth } from "../../../js/firebase.js";
import { telegramConfig } from "../config/telegram-config.js";

const functions = getFunctions(app, "asia-south1");

export class TelegramApiService {
  constructor(functionName = telegramConfig.callableFunction) {
    this.call = httpsCallable(functions, functionName);
  }

  async request(action, payload = {}) {
    if (!auth.currentUser) throw new Error("Authentication is required.");
    const response = await this.call({ action, ...payload });
    return response.data;
  }

  getStatus() { return this.request("status"); }
  configureBot(token) { return this.request("configureBot", { token }); }
  listChannels() { return this.request("listChannels"); }
  addChannel(channelId) { return this.request("addChannel", { channelId }); }
  deleteChannel(channelId) { return this.request("deleteChannel", { channelId }); }
  verifyChannel(channelId) { return this.request("verifyChannel", { channelId }); }
  sendTestMessage(channelId, message) { return this.request("sendTestMessage", { channelId, message }); }
  getSettings() { return this.request("getSettings"); }
  updateSettings(settings) { return this.request("updateSettings", { settings }); }
}
