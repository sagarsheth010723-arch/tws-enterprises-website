const SESSION_KEY = "tws-secure-panel-local-session";

export async function startSession(user) {
  const existing = sessionStorage.getItem(SESSION_KEY);
  const session = existing ? JSON.parse(existing) : {
    uid: user.uid,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString()
  };
  session.lastActivityAt = new Date().toISOString();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  console.info("[TWS Auth] Local browser session preserved.", session);
  return session;
}

export async function recordActivity() {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (!existing) return;
  const session = JSON.parse(existing);
  session.lastActivityAt = new Date().toISOString();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function endSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function getUserSessions(userId) {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (!existing) return [];
  const session = JSON.parse(existing);
  if (session.uid !== userId) return [];
  return [{ id: "current-browser", isActive: true, startedAt: { toDate: () => new Date(session.startedAt) }, lastActivityAt: { toDate: () => new Date(session.lastActivityAt) } }];
}
