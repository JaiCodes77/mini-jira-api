const KEY = "mini_jira_auth";

/** @returns {{ token: string, username: string } | null} */
export function loadAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.token && typeof data.token === "string") {
      return { token: data.token, username: String(data.username ?? "") };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function saveAuth({ token, username }) {
  localStorage.setItem(KEY, JSON.stringify({ token, username }));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
