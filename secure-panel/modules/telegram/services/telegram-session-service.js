export class TelegramSessionService {
  constructor() {
    this.connectionState = "disabled";
  }

  get status() {
    return this.connectionState;
  }
}
