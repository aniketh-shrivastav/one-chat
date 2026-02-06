import React, { useEffect, useRef, useMemo } from "react";
import Avatar from "../Avatar";

// Utility formatters
const formatDay = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};
const formatTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageList = ({ messages = [], currentUserId, userMap }) => {
  const scrollRef = useRef(null);

  // Resolve a file path like "/uploads/..." to the backend origin
  const resolveUrl = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const api = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
    const origin = api.replace(/\/api\/?$/, "");
    return `${origin}${url}`;
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Group by day for dividers
  const grouped = useMemo(() => {
    const map = {};
    messages.forEach((m) => {
      const day = formatDay(m.createdAt || m.timestamp);
      if (!map[day]) map[day] = [];
      map[day].push(m);
    });
    return map;
  }, [messages]);

  const isMine = (m) => m.sender === currentUserId;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-6 oc-bg oc-scrollbars"
    >
      {Object.entries(grouped).map(([day, msgs]) => (
        <div key={day} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-600 to-transparent" />
            <span className="px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-full oc-surface-elevated text-gray-600 dark:text-slate-200 shadow border oc-border">
              {day}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-600 to-transparent" />
          </div>
          {msgs.map((m) => {
            const mine = isMine(m);
            const sender = userMap[m.sender] || {};
            return (
              <div
                key={m._id}
                className={`flex items-end gap-2 max-w-[75%] ${
                  mine ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                <Avatar
                  size={36}
                  name={sender.name || sender.username || "?"}
                  avatarUrl={sender.avatarUrl}
                />
                <div className="flex flex-col min-w-0">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 whitespace-pre-wrap break-words ${
                      mine
                        ? "bg-cyan-600 text-white"
                        : "bg-white text-gray-800 dark:bg-slate-700 dark:text-slate-100"
                    }`}
                  >
                    {!mine && (
                      <p className="text-[11px] font-semibold mb-0.5 opacity-80">
                        {sender.name || sender.username || "Unknown"}
                      </p>
                    )}
                    {m.attachment ? (
                      <div className="space-y-1">
                        {m.attachment.type === "image" && (
                          <img
                            src={resolveUrl(m.attachment.url)}
                            alt={m.attachment.name || "image"}
                            className="max-w-full rounded"
                          />
                        )}
                        {m.attachment.type === "video" && (
                          <video
                            src={resolveUrl(m.attachment.url)}
                            controls
                            className="max-w-full rounded"
                          />
                        )}
                        {m.attachment.type === "audio" && (
                          <audio
                            src={resolveUrl(m.attachment.url)}
                            controls
                            className="w-full"
                          />
                        )}
                        {m.attachment.type === "file" && (
                          <a
                            href={resolveUrl(m.attachment.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            {m.attachment.name || "Download file"}
                          </a>
                        )}
                        {m.message_text && <p>{m.message_text}</p>}
                      </div>
                    ) : (
                      <p>{m.message_text || m.text}</p>
                    )}
                    <p className="mt-1 text-[10px] opacity-60 text-right">
                      {formatTime(m.createdAt || m.timestamp)}
                      {mine && m.readBy?.length > 1 && (
                        <span className="ml-1">• Read</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No messages</p>
      )}
    </div>
  );
};

export default MessageList;
