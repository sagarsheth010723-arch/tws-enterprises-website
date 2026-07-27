import { telegramConfig } from "../config/telegram-config.js";

export class TelegramApiService {
  constructor(config = telegramConfig) {
    this.config = config;
  }

  get isEnabled() {
    return this.config.enabled === true;
  }

  assertEnabled() {
    if (!this.isEnabled) throw new Error("Telegram integration has not been enabled.");
  }
}
