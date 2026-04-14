const KEY = "mini_jira_auth";

/** @returns {{ token: string, username: string, user_id?: number } | null} */
export function loadAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.token && typeof data.token === "string") {
      return {
        token: data.token,
        username: String(data.username ?? ""),
        user_id:
          typeof data.user_id === "number"
            ? data.user_id
            : Number.isFinite(Number(data.user_id))
              ? Number(data.user_id)
              : undefined,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function saveAuth({ token, username, user_id }) {
  localStorage.setItem(KEY, JSON.stringify({ token, username, user_id }));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
