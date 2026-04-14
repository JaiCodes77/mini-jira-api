import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "./Toasts";
import MarkdownText from "./MarkdownText";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    <div className="comment-thread">
      <span className="comment-thread__title">Comments</span>

      {loading ? (
        <p className="comment-empty">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="comment-empty">No comments yet.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <div className="comment-item__header">
                <span className="comment-item__author">{comment.author.username}</span>
                <span className="comment-item__date">{formatDate(comment.created_at)}</span>
                {comment.author_id === currentUserId && (
                  <div className="comment-item__actions">
                    <button
                      type="button"
                      className="comment-item__delete"
                      onClick={() => handleEditStart(comment)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="comment-item__delete"
                      onClick={() => void handleDelete(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {comment.mentioned_users?.length > 0 && (
                <div className="comment-item__mentions">
                  Mentioned:{" "}
                  {comment.mentioned_users.map((user) => `@${user.username}`).join(", ")}
                </div>
              )}
              {editingId === comment.id ? (
                <div className="comment-item__editor">
                  <textarea
                    className="comment-form__input comment-form__textarea"
                    rows="3"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="comment-item__actions">
                    <button
                      type="button"
                      className="comment-form__submit"
                      onClick={() => void handleEditSave()}
                      disabled={!editBody.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn subtle btn-compact"
                      onClick={() => {
                        setEditingId(null);
                        setEditBody("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <MarkdownText className="comment-item__body markdown-body" value={comment.body} />
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="comment-thread__footer">
          <button
            type="button"
            className="btn subtle btn-compact"
            disabled={offset === 0}
            onClick={() => void fetchComments(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </button>
          <span className="comment-thread__page-info">
            {Math.min(offset + 1, total)}-{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            type="button"
            className="btn subtle btn-compact"
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
            className="comment-form__input comment-form__textarea"
            rows="3"
            placeholder="Write a comment. Use @username to mention teammates."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {mentionHint && (
            <span className="comment-thread__hint">Try mentions like {mentionHint}</span>
          )}
          <button
            type="submit"
            className="comment-form__submit"
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </form>
      )}
    </div>
  );
}
