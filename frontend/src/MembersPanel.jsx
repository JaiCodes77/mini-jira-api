import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import Modal from "./components/Modal";
import { toast } from "./Toasts";

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  return fallback;
}

export default function MembersPanel({ project, isOwner, fetchWithAuth, onClose }) {
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/projects/${project.id}/members`);
    if (!response.ok) {
      toast(await readError(response, "Could not load members."), "error");
      return;
    }
    setMembers(await response.json());
  }, [fetchWithAuth, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (event) => {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), role }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error(await readError(response, "Could not add member."));
      }
      setUsername("");
      await load();
      toast("Member added.");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Remove ${member.username} from ${project.key}?`)) return;
    const response = await fetchWithAuth(
      `${API_BASE_URL}/projects/${project.id}/members/${member.user_id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast(await readError(response, "Could not remove member."), "error");
      return;
    }
    await load();
    toast("Member removed.");
  };

  return (
    <Modal title={`${project.key} people`} onClose={onClose}>
      <p className="members__intro">
        Owners manage the catalog. Members edit issues. Viewers can follow along and comment.
      </p>
      {isOwner && (
        <form className="members__form" onSubmit={invite}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="teammate"
              autoComplete="off"
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      <ul className="members__list">
        {members.map((member) => (
          <li key={member.id} className="members__row">
            <div>
              <strong>{member.username}</strong>
              <span>{member.email}</span>
            </div>
            <span className="members__role">{member.role}</span>
            {isOwner && member.role !== "owner" && (
              <button type="button" className="btn btn--danger" onClick={() => void remove(member)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
