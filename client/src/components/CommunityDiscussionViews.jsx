import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, MessageCircle, X } from "lucide-react";
import {
  createDiscussionComment,
  deleteDiscussionComment,
  getDiscussion,
  getDiscussionComments,
  getDiscussions,
  openChatConnection,
  updateDiscussionComment,
} from "../services/phase4Services.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const DISCUSSION_PAGE_SIZE = 20;

export function CommunityDiscussionForum() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);

  const loadPage = async (requestedPage, append = false) => {
    setStatus(append ? "loading-more" : "loading");
    setMessage("");
    try {
      const data = await getDiscussions({ page: requestedPage, limit: DISCUSSION_PAGE_SIZE });
      const nextItems = data.discussions || [];
      setItems((current) => append
        ? [...current, ...nextItems.filter((next) => !current.some((item) => String(item.id) === String(next.id)))]
        : nextItems);
      setPage(data.page || requestedPage);
      setHasNext(Boolean(data.hasNext));
      setTotal(Number(data.total || 0));
      setStatus("ready");
    } catch (error) {
      setStatus(append ? "load-more-error" : "error");
      setMessage(error.message);
    }
  };

  useEffect(() => { loadPage(1); }, []);

  const visible = items.filter((item) => `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  const isFirstLoading = status === "loading";

  return <section className="forum-page"><div className="content-width forum-head"><div><p className="eyebrow">COMMUNITY / DISCUSSION FORUM</p><h1>Bring the field question to the room.</h1><p className="page-lead">Browse farmer discussions, then open a detail view or create a new post with the full crop context.</p></div><div className="forum-actions"><Link href="/community/discussion-forum/create" className="button button--ochre">Create discussion <ArrowRight size={15}/></Link>{!token && <Link href="/login" className="text-link">Login for posting <ArrowRight size={15}/></Link>}</div></div><div className="content-width forum-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded discussions" aria-label="Search loaded discussions"/><button className="button button--leaf" type="button" onClick={() => loadPage(1)} disabled={isFirstLoading}>{isFirstLoading ? "Loading…" : "Refresh feed"}</button></div><p className="content-width forum-search-note">Search filters the discussions currently loaded in this feed.</p><div className="content-width forum-list">{isFirstLoading && <div className="service-state"><span className="loading-dot"/><div><strong>Loading discussions…</strong><p>Requesting the first page of persisted Community discussions.</p></div></div>}{status === "error" && <div className="service-state service-state--error"><X size={22}/><div><strong>Discussion feed unavailable</strong><p>{message}</p><button className="text-button" type="button" onClick={() => loadPage(1)}>Retry feed</button></div></div>}{status === "ready" && visible.length === 0 && <div className="empty-result empty-result--wide"><MessageCircle size={24}/><div><strong>{items.length === 0 ? "No discussions yet." : "No loaded discussions match this search."}</strong><p>{items.length === 0 ? "Be the first to start a field conversation." : "Try another term or load more discussions."}</p></div></div>}{(status === "ready" || status === "loading-more" || status === "load-more-error") && visible.map((item) => <Link className="discussion-card" href={`/community/discussion-forum/details?id=${item.id}`} key={item.id}><div><p className="eyebrow">{item.problemType || "FIELD DISCUSSION"}</p><h2>{item.title || "Untitled discussion"}</h2><p>{item.description || "Open this discussion to read the full field context."}</p></div><ArrowRight size={19}/></Link>)}</div>{(status === "ready" || status === "loading-more" || status === "load-more-error") && <div className="content-width forum-pagination"><p>{total ? `${items.length} of ${total} discussions loaded.` : "No discussions loaded."}</p>{hasNext && <button className="button button--leaf" type="button" disabled={status === "loading-more"} onClick={() => loadPage(page + 1, true)}>{status === "loading-more" ? "Loading more…" : "Load more discussions"} <ArrowRight size={15}/></button>}{status === "load-more-error" && <p className="comment-form-error" role="alert">{message} <button className="text-button" type="button" onClick={() => loadPage(page + 1, true)}>Retry load more</button></p>}{status === "ready" && !hasNext && items.length > 0 && <p className="forum-pagination-complete">No more discussions to load.</p>}</div>}</section>;
}

export function CommunityDiscussionDetails() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [discussion, setDiscussion] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsStatus, setCommentsStatus] = useState("idle");
  const [commentsMessage, setCommentsMessage] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentSubmitStatus, setCommentSubmitStatus] = useState("idle");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("idle");
  const [commentActionStatus, setCommentActionStatus] = useState("idle");
  const [commentActionMessage, setCommentActionMessage] = useState("");
  const [chatStatus, setChatStatus] = useState({ state: "idle", message: "Chat is ready to connect when a discussion is selected." });
  const [chatMessage, setChatMessage] = useState("");
  const [sendChat, setSendChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const discussionId = new URLSearchParams(window.location.search).get("id");

  const load = async () => { setStatus("loading"); try { if (!discussionId) throw new Error("Select a discussion from the forum to open its details."); const data = await getDiscussion(discussionId); setDiscussion(data.discussion || data); setStatus("ready"); } catch (error) { setStatus("error"); setMessage(error.message); } };
  const loadComments = async () => { setCommentsStatus("loading"); try { if (!discussionId) throw new Error("Select a discussion from the forum to view comments."); const data = await getDiscussionComments(discussionId); setComments(data.comments || []); setCommentsStatus("ready"); setCommentsMessage(""); } catch (error) { setCommentsStatus("error"); setCommentsMessage(error.message); } };

  useEffect(() => { loadComments(); }, []);
  useEffect(() => {
    setChatMessages([]);
    setSendChat(null);
    const receiveChatMessage = (next) => setChatMessages((messages) => messages.some((message) => message.id === next.id) ? messages : [...messages, next]);
    return openChatConnection({
      token,
      roomId: discussionId,
      onMessage: receiveChatMessage,
      onHistory: setChatMessages,
      onStatus: setChatStatus,
      onReady: (sender) => setSendChat(() => sender),
    });
  }, [discussionId, token]);

  const threads = useMemo(() => {
    const repliesByParent = new Map();
    const topLevel = [];
    comments.forEach((comment) => {
      if (comment.parentCommentId === null || comment.parentCommentId === undefined) topLevel.push(comment);
      else repliesByParent.set(String(comment.parentCommentId), [...(repliesByParent.get(String(comment.parentCommentId)) || []), comment]);
    });
    return topLevel.map((comment) => ({ comment, replies: repliesByParent.get(String(comment.id)) || [] }));
  }, [comments]);

  const submitComment = async (event) => { event.preventDefault(); if (!token) { setCommentSubmitStatus("error"); setCommentsMessage("Login is required before posting a comment."); return; } const text = commentText.trim(); if (!text) { setCommentSubmitStatus("error"); setCommentsMessage("Write a comment before posting."); return; } if (!discussionId) { setCommentSubmitStatus("error"); setCommentsMessage("Select a discussion before posting a comment."); return; } setCommentSubmitStatus("loading"); try { const data = await createDiscussionComment(discussionId, text, token); setComments((items) => [...items, data.comment || data]); setCommentText(""); setCommentSubmitStatus("success"); setCommentsMessage(""); } catch (error) { setCommentSubmitStatus("error"); setCommentsMessage(error.message); } };
  const submitReply = async (event) => { event.preventDefault(); if (!token || !replyParentId) return; const text = replyText.trim(); if (!text) { setReplyStatus("error"); setCommentActionMessage("Write a reply before posting."); return; } setReplyStatus("loading"); setCommentActionMessage(""); try { const data = await createDiscussionComment(discussionId, text, token, replyParentId); setComments((items) => [...items, data.comment || data]); setReplyParentId(null); setReplyText(""); setReplyStatus("idle"); } catch (error) { setReplyStatus("error"); setCommentActionMessage(error.message); } };
  const startCommentEdit = (comment) => { setEditingCommentId(comment.id); setEditingCommentText(comment.text); setCommentActionMessage(""); };
  const cancelCommentEdit = () => { setEditingCommentId(null); setEditingCommentText(""); setCommentActionMessage(""); };
  const saveCommentEdit = async (commentId) => { const text = editingCommentText.trim(); if (!text) { setCommentActionStatus("error"); setCommentActionMessage("Comment text is required."); return; } setCommentActionStatus(`saving-${commentId}`); setCommentActionMessage(""); try { const data = await updateDiscussionComment(commentId, text, token); const updatedComment = data.comment || data; setComments((items) => items.map((comment) => comment.id === commentId ? updatedComment : comment)); cancelCommentEdit(); setCommentActionStatus("success"); } catch (error) { setCommentActionStatus("error"); setCommentActionMessage(error.message); } };
  const removeComment = async (commentId) => { if (!window.confirm("Delete this comment? This cannot be undone.")) return; setCommentActionStatus(`deleting-${commentId}`); setCommentActionMessage(""); try { const result = await deleteDiscussionComment(commentId, token); if (result.preservedReplies) await loadComments(); else setComments((items) => items.filter((comment) => comment.id !== commentId)); setCommentActionStatus("success"); } catch (error) { setCommentActionStatus("error"); setCommentActionMessage(error.message); } };
  const sendMessage = async () => { if (!sendChat || !chatMessage.trim()) return; try { await sendChat({ discussionId, text: chatMessage.trim() }); setChatMessage(""); } catch (error) { setChatStatus({ state: "error", message: error.message || "Chat server rejected the message." }); } };

  const CommentCard = ({ comment, isReply = false }) => {
    const isOwner = Boolean(token && user && String(comment.authorId) === String(user.id));
    const isEditing = editingCommentId === comment.id;
    const isDeleted = Boolean(comment.deletedAt);
    return <article className={`comment-card${isReply ? " comment-card--reply" : ""}${isDeleted ? " comment-card--deleted" : ""}`} key={comment.id}><div className="comment-meta"><strong>{comment.authorName || "Community member"}</strong><span>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Timestamp unavailable"}</span></div>{isEditing ? <div className="comment-edit-form"><label>Edit comment<textarea rows="3" maxLength="2000" value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} /></label><div className="comment-edit-actions"><button className="button button--leaf" type="button" disabled={commentActionStatus === `saving-${comment.id}`} onClick={() => saveCommentEdit(comment.id)}>{commentActionStatus === `saving-${comment.id}` ? "Saving…" : "Save"}</button><button className="text-button" type="button" onClick={cancelCommentEdit}>Cancel</button></div></div> : <p>{isDeleted ? "[Deleted comment]" : comment.text}</p>}{!isDeleted && isOwner && !isEditing && <div className="comment-owner-actions"><button className="text-button" type="button" onClick={() => startCommentEdit(comment)}>Edit</button><button className="text-button text-button--danger" type="button" disabled={commentActionStatus === `deleting-${comment.id}`} onClick={() => removeComment(comment.id)}>{commentActionStatus === `deleting-${comment.id}` ? "Deleting…" : "Delete"}</button></div>}{!isDeleted && !isReply && <div className="comment-reply-actions"><button className="text-button" type="button" onClick={() => { setReplyParentId(comment.id); setReplyText(""); setReplyStatus("idle"); }}>Reply</button></div>}{replyParentId === comment.id && <form className="reply-form" onSubmit={submitReply}><label>Reply<textarea rows="2" maxLength="2000" value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a helpful reply"/></label><div className="comment-edit-actions"><button className="button button--leaf" type="submit" disabled={replyStatus === "loading"}>{replyStatus === "loading" ? "Posting…" : "Post reply"}</button><button className="text-button" type="button" onClick={() => { setReplyParentId(null); setReplyText(""); setReplyStatus("idle"); }}>Cancel</button></div></form>}</article>;
  };

  return <section className="discussion-detail-page"><div className="content-width"><p className="eyebrow">COMMUNITY / DISCUSSION DETAILS</p><h1>Read the full field context.</h1><div className="detail-actions"><button className="button button--leaf" type="button" onClick={load}>{status === "loading" ? "Loading…" : "Load discussion"}</button><Link href="/community/discussion-forum" className="text-link">Back to forum <ArrowRight size={15}/></Link></div>{status === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Discussion unavailable</strong><p>{message}</p></div></div>}{status === "ready" && discussion && <article className="discussion-detail-card"><p className="eyebrow">{discussion.problemType || "FIELD DISCUSSION"}</p><h2>{discussion.title || "Discussion"}</h2><p>{discussion.detailedDescription || discussion.description || "No description returned."}</p><div className="detail-meta"><span>Crop <b>{discussion.cropType || "Not provided"}</b></span><span>Growth stage <b>{discussion.growthStage || "Not provided"}</b></span><span>Desired outcome <b>{discussion.desiredOutcome || "Not provided"}</b></span></div></article>}<section className="comments-panel"><div className="comments-heading"><div><p className="section-kicker">DISCUSSION COMMENTS</p><h2>Share a field note.</h2></div>{commentsStatus === "ready" && <span>{comments.length} {comments.length === 1 ? "comment" : "comments"}</span>}</div>{commentsStatus === "loading" && <div className="service-state"><span className="loading-dot"/><div><strong>Loading comments…</strong><p>Requesting persisted discussion comments.</p></div></div>}{commentsStatus === "error" && <div className="service-state service-state--error"><X size={21}/><div><strong>Comments unavailable</strong><p>{commentsMessage}</p><button className="text-button" type="button" onClick={loadComments}>Retry comments</button></div></div>}{commentsStatus === "ready" && comments.length === 0 && <div className="empty-result"><MessageCircle size={23}/><div><strong>No comments yet. Be the first to share your thoughts.</strong></div></div>}{commentsStatus === "ready" && threads.length > 0 && <div className="comment-list">{threads.map(({ comment, replies }) => <div className="comment-thread" key={comment.id}><CommentCard comment={comment}/>{replies.length > 0 && <div className="comment-replies">{replies.map((reply) => <CommentCard comment={reply} isReply key={reply.id}/>)}</div>}</div>)}</div>}{(commentActionStatus === "error" || replyStatus === "error") && <p className="comment-form-error" role="alert">{commentActionMessage}</p>}{token ? <form className="comment-form" onSubmit={submitComment}><label>Add a comment<textarea rows="3" maxLength="2000" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Share a helpful field note"/></label><button className="button button--leaf" type="submit" disabled={commentSubmitStatus === "loading"}>{commentSubmitStatus === "loading" ? "Posting…" : "Post comment"} <ArrowRight size={15}/></button>{commentSubmitStatus === "error" && <p className="comment-form-error" role="alert">{commentsMessage}</p>}</form> : <p className="comment-login-note">Login is required before posting a comment. <Link href="/login" className="text-link">Login <ArrowRight size={15}/></Link></p>}</section><section className="chat-panel"><div><p className="section-kicker">DISCUSSION CHAT</p><h2>Keep the conversation close.</h2></div><div className={`chat-state chat-state--${chatStatus.state}`}><MessageCircle size={21}/><div><strong>{chatStatus.state === "connected" ? "Chat connected" : chatStatus.state === "connecting" || chatStatus.state === "reconnecting" ? "Connecting to chat" : "Chat unavailable"}</strong><p>{chatStatus.message}</p></div></div>{chatMessages.length > 0 && <div className="chat-message-list" aria-live="polite">{chatMessages.map((message) => <article className={`chat-message${String(message.authorId) === String(user?.id) ? " chat-message--own" : ""}`} key={message.id}><strong>{message.authorName || "Community member"}</strong><p>{message.text}</p><small>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : "Timestamp unavailable"}</small></article>)}</div>}<div className="chat-form"><input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} maxLength="1000" placeholder="Write a message when chat is connected" disabled={chatStatus.state !== "connected"}/><button className="button button--ochre" disabled={chatStatus.state !== "connected" || !chatMessage.trim() || !sendChat} onClick={sendMessage}>Send</button></div></section></div></section>;
}
