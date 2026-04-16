import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";
import MarkdownText from "./MarkdownText";
import { userInitials } from "./issueConstants";

const formatDate = (value) => {
  const date = new Date(value);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const PAGE_SIZE = 20;

export default function CommentThread({ bugId, auth, fetchWithAuth, mentionableUsers = [] }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchComments = useCallback(async (nextOffset = 0) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/bugs/${bugId}/comments?limit=${PAGE_SIZE}&offset=${nextOffset}`,
      );
      if (!response.ok) throw new Error("Failed to load comments.");
      const data = await response.json();
      setComments(data.items);
      setTotal(data.total);
      setOffset(nextOffset);
    } catch (err) {
      toast(err.message || "Could not load comments.", "error");
    } finally {
      setLoading(false);
    }
  }, [bugId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      setSubmitting(true);
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to add comment.");
      }
      setBody("");
      await fetchComments(0);
      toast("Comment added.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to delete comment.");
      }
      await fetchComments(offset);
      toast("Comment deleted.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const handleEditStart = (comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const handleEditSave = async () => {
    if (!editBody.trim()) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/bugs/${bugId}/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) return;
        throw new Error("Failed to update comment.");
      }
      setEditingId(null);
      setEditBody("");
      await fetchComments(offset);
      toast("Comment updated.");
    } catch (err) {
      toast(err.message || "Something went wrong.", "error");
    }
  };

  const currentUserId = auth?.user_id;
  const mentionHint = useMemo(
    () => mentionableUsers.slice(0, 4).map((user) => `@${user.username}`).join(", "),
    [mentionableUsers],
  );

  return (
    <div className="comments">
      {loading ? (
        <div className="detail-section__empty">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="detail-section__empty">No comments yet. Start the conversation.</div>
      ) : (
        comments.map((comment) => {
          const isAuthor = comment.author_id === currentUserId;
          const isEditing = editingId === comment.id;
          return (
            <article key={comment.id} className="comment">
              <div className="comment__header">
                <span className="avatar" aria-hidden>{userInitials(comment.author.username)}</span>
                <span className="comment__author">{comment.author.username}</span>
                <span className="comment__date">{formatDate(comment.created_at)}</span>
                {isAuthor && !isEditing && (
                  <div className="comment__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleEditStart(comment)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void handleDelete(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setEditingId(null);
                        setEditBody("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void handleEditSave()}
                      disabled={!editBody.trim()}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MarkdownText value={comment.body} />
                  {comment.mentioned_users?.length > 0 && (
                    <div className="comment__mentions">
                      Mentioned: {comment.mentioned_users.map((user) => `@${user.username}`).join(", ")}
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="comment-pager">
          <button
            type="button"
            className="btn"
            disabled={offset === 0}
            onClick={() => void fetchComments(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </button>
          <span>
            {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            type="button"
            className="btn"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => void fetchComments(offset + PAGE_SIZE)}
          >
            Older
          </button>
        </div>
      )}

      {auth?.token && (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Write a comment. Use @username to mention teammates."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="comment-form__actions">
            {mentionHint && (
              <span className="comment-form__hint">Mentions: {mentionHint}</span>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !body.trim()}
            >
              {submitting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
