import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { Avatar } from "./components/IssueGlyphs";
import { CloseIcon } from "./components/Icons";
import Modal from "./components/Modal";
import { toast } from "./Toasts";

const ROLE_HINTS = {
  owner: "Manages people and planning",
  member: "Creates and edits issues",
  viewer: "Reads and comments",
};

async function readError(response, fallback) {
  const body = await response.json().catch(() => null);
  if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg).join(" ");
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export default function MembersPanel({ project, isOwner, fetchWithAuth, onClose }) {
  const [members, setMembers] = useState(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/projects/${project.id}/members`);
    if (!response.ok) {
      toast(await readError(response, "Could not load people."), "error");
      setMembers([]);
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
        throw new Error(await readError(response, "Could not add that person."));
      }
      setUsername("");
      await load();
      toast(`${username.trim()} joined ${project.key}.`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Remove ${member.username} from ${project.name}?`)) return;
    const response = await fetchWithAuth(
      `${API_BASE_URL}/projects/${project.id}/members/${member.user_id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      toast(await readError(response, "Could not remove that person."), "error");
      return;
    }
    await load();
    toast(`${member.username} was removed.`);
  };

  return (
    <Modal
      title="People"
      subtitle={`Who can see and work on ${project.name}.`}
      onClose={onClose}
      size="md"
    >
      {isOwner && (
        <form className="invite" onSubmit={invite}>
          <label className="visually-hidden" htmlFor="invite-username">
            Username
          </label>
          <input
            id="invite-username"
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Add someone by username"
            autoComplete="off"
          />
          <label className="visually-hidden" htmlFor="invite-role">
            Role
          </label>
          <select id="invite-role" className="select" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn--primary" disabled={busy || !username.trim()}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Add
          </button>
        </form>
      )}

      {members === null ? (
        <div className="people">
          {[0, 1].map((index) => (
            <div key={index} className="person person--skeleton">
              <span className="shimmer shimmer--round" />
              <span className="shimmer" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      ) : (
        <ul className="people">
          <AnimatePresence initial={false}>
            {members.map((member) => (
              <motion.li
                key={member.id}
                layout="position"
                className="person"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <Avatar name={member.username} size="lg" />
                <span className="person__who">
                  <span className="person__name">{member.username}</span>
                  <span className="person__email">{member.email}</span>
                </span>
                <span className="person__role" title={ROLE_HINTS[member.role]}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>
                {isOwner && member.role !== "owner" ? (
                  <button
                    type="button"
                    className="icon-button icon-button--sm icon-button--danger"
                    aria-label={`Remove ${member.username}`}
                    onClick={() => void remove(member)}
                  >
                    <CloseIcon size={14} />
                  </button>
                ) : (
                  <span className="person__spacer" />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <p className="modal__note">
        Owners manage people and planning. Members create and edit issues. Viewers read and comment.
      </p>
    </Modal>
  );
}
