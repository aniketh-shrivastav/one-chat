import React from "react";
import Avatar from "../Avatar";
import { Link } from "react-router-dom";
import api from "../../utils/api";

const Sidebar = ({
  tab,
  setTab,
  resetActive,
  groups,
  users,
  activeGroup,
  activeUser,
  selectGroup,
  selectUser,
  groupUnreadCounts,
  directUnreadCounts,
  onShowCreateGroup,
  onShowProfile,
  currentUserName,
  currentUser,
  onStartDm,
  onPrefillDmUsername,
}) => {
  const [directQuery, setDirectQuery] = React.useState("");
  const [remoteResults, setRemoteResults] = React.useState([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState("");
  const abortRef = React.useRef(null);

  const filteredUsers = React.useMemo(() => {
    if (!directQuery.trim()) return users;
    const q = directQuery.toLowerCase();
    return users.filter((u) => {
      const uname = (u.username || u.email || "").toLowerCase();
      const name = (u.name || "").toLowerCase();
      return uname.includes(q) || name.includes(q);
    });
  }, [users, directQuery]);

  // Remote search for NEW users (not in existing partners list)
  React.useEffect(() => {
    const q = directQuery.trim();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setRemoteError("");
    if (q.length < 2) {
      setRemoteResults([]);
      setRemoteLoading(false);
      return;
    }
    // If local partners already match sufficiently, still show remote to discover new users
    const controller = new AbortController();
    abortRef.current = controller;
    setRemoteLoading(true);
    const timer = setTimeout(() => {
      api
        .get(`/chat/users/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        .then((res) => {
          setRemoteResults(res.data.results || []);
        })
        .catch((err) => {
          if (err.name !== "CanceledError" && err.name !== "AbortError") {
            setRemoteError(err?.response?.data?.msg || "Search failed");
          }
        })
        .finally(() => {
          setRemoteLoading(false);
        });
    }, 350); // debounce 350ms
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [directQuery]);

  const partnerIds = React.useMemo(
    () => new Set(users.map((u) => u._id)),
    [users]
  );
  const newUserResults = remoteResults.filter((r) => !partnerIds.has(r._id));

  return (
    <aside className="w-72 border-r p-4 flex flex-col oc-surface oc-border dark:text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onShowProfile}
          className="flex items-center gap-2 group"
        >
          <Avatar
            size={40}
            name={currentUserName || "User"}
            avatarUrl={currentUser?.avatarUrl}
          />
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold leading-tight group-hover:text-cyan-400 oc-text-strong">
              {currentUserName || "Profile"}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              {currentUser?.status || "offline"}
            </span>
          </div>
        </button>
      </div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => {
            setTab("groups");
            resetActive();
          }}
          className={`flex-1 px-2 py-1 rounded text-sm border ${
            tab === "groups"
              ? "bg-cyan-600 text-white border-cyan-600"
              : "bg-white hover:bg-cyan-50 dark:bg-slate-700/40 dark:text-slate-200 dark:hover:bg-slate-600/60"
          }`}
        >
          Groups
        </button>
        <button
          onClick={() => {
            setTab("direct");
            resetActive();
          }}
          className={`flex-1 px-2 py-1 rounded text-sm border ${
            tab === "direct"
              ? "bg-cyan-600 text-white border-cyan-600"
              : "bg-white hover:bg-cyan-50 dark:bg-slate-700/40 dark:text-slate-200 dark:hover:bg-slate-600/60"
          }`}
        >
          Direct
        </button>
      </div>
      {tab === "groups" && (
        <ul className="flex-1 overflow-y-auto space-y-1" aria-label="Groups">
          {groups.map((g) => {
            const unread = groupUnreadCounts[g._id] || 0;
            return (
              <li key={g._id}>
                <button
                  onClick={() => selectGroup(g)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded transition-colors hover:bg-cyan-100 dark:hover:bg-slate-600/70 ${
                    activeGroup?._id === g._id
                      ? "bg-cyan-200 dark:bg-slate-500/70 dark:oc-text-strong"
                      : "dark:text-slate-300"
                  }`}
                >
                  <span className="truncate mr-2 text-sm font-medium oc-text-strong dark:font-semibold">
                    {g.group_name}
                  </span>
                  {unread > 1 && (
                    <span className="ml-auto inline-block bg-cyan-600 text-white text-xs px-2 py-0.5 rounded-full dark:ring-1 dark:ring-black/20">
                      {unread}
                    </span>
                  )}
                  {unread === 1 && (
                    <span
                      className="ml-auto inline-block bg-cyan-600 text-white text-[6px] px-1 py-1 rounded-full opacity-60"
                      aria-label="1 unread (suppressed)"
                    ></span>
                  )}
                </button>
              </li>
            );
          })}
          {groups.length === 0 && (
            <li className="text-xs text-gray-500 px-2 py-1">No groups yet</li>
          )}
        </ul>
      )}
      {tab === "groups" && (
        <button
          onClick={() => onShowCreateGroup()}
          className="mt-2 w-full text-sm bg-cyan-600 text-white py-2 rounded hover:bg-cyan-700"
        >
          + New Group
        </button>
      )}
      {tab === "direct" && (
        <>
          <div className="mb-2">
            <input
              value={directQuery}
              onChange={(e) => setDirectQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-2 py-1 text-sm rounded border bg-white dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              aria-label="Search direct message users"
            />
          </div>
          <ul className="flex-1 overflow-y-auto space-y-1" aria-label="Users">
            {filteredUsers.map((u) => {
              const unread = directUnreadCounts[u._id] || 0;
              const lastTime = u.lastMessageAt
                ? new Date(u.lastMessageAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              return (
                <li key={u._id}>
                  <button
                    onClick={() => selectUser(u)}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded transition-colors hover:bg-cyan-100 dark:hover:bg-slate-600/70 ${
                      activeUser?._id === u._id
                        ? "bg-cyan-200 dark:bg-slate-500/70 dark:oc-text-strong"
                        : "dark:text-slate-300"
                    }`}
                  >
                    <span className="truncate mr-2 flex items-center gap-2">
                      <span className="relative">
                        <Avatar
                          size={28}
                          name={u.name || u.username || u.email}
                          avatarUrl={u.avatarUrl}
                        />
                        <span
                          className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                            u.status === "online"
                              ? "bg-emerald-500"
                              : u.status === "away"
                              ? "bg-amber-400"
                              : u.status === "busy"
                              ? "bg-rose-500"
                              : "bg-gray-300"
                          }`}
                          aria-label={u.status}
                        />
                      </span>
                      <span className="flex flex-col items-start truncate">
                        <span className="text-sm font-medium leading-tight truncate oc-text-strong">
                          {u.username || u.email}
                        </span>
                        <span className="text-[10px] text-gray-500 leading-tight flex gap-1 items-center">
                          {u.messageCount ? `${u.messageCount} msgs` : ""}
                          {lastTime && <span>• {lastTime}</span>}
                        </span>
                      </span>
                    </span>
                    {unread > 1 && (
                      <span className="ml-auto inline-block bg-cyan-600 text-white text-xs px-2 py-0.5 rounded-full dark:ring-1 dark:ring-black/20">
                        {unread}
                      </span>
                    )}
                    {unread === 1 && (
                      <span
                        className="ml-auto inline-block bg-cyan-600 text-white text-[6px] px-1 py-1 rounded-full opacity-60"
                        aria-label="1 unread (suppressed)"
                      ></span>
                    )}
                  </button>
                </li>
              );
            })}
            {filteredUsers.length === 0 && (
              <li className="text-xs text-gray-500 px-2 py-1">
                {directQuery.trim()
                  ? "No matches in conversations"
                  : "No conversations yet — start one."}
              </li>
            )}
            {directQuery.trim() && (
              <li className="px-2 pt-2 text-[10px] uppercase tracking-wide text-gray-400">
                Discover New Users
              </li>
            )}
            {remoteLoading && (
              <li className="text-xs text-gray-500 px-2 py-1">Searching...</li>
            )}
            {!remoteLoading && remoteError && (
              <li className="text-xs text-red-600 px-2 py-1">{remoteError}</li>
            )}
            {!remoteLoading &&
              !remoteError &&
              newUserResults.map((u) => (
                <li key={u._id + "-remote"}>
                  <button
                    onClick={() => {
                      if (onPrefillDmUsername) onPrefillDmUsername(u.username);
                    }}
                    className="w-full flex items-center justify-between text-left px-3 py-2 rounded transition-colors bg-cyan-50 hover:bg-cyan-100 dark:bg-slate-700/40 dark:hover:bg-slate-600/60 border border-cyan-100 dark:border-slate-600"
                  >
                    <span className="truncate mr-2 flex items-center gap-2">
                      <Avatar
                        size={24}
                        name={u.name || u.username || u.email}
                        avatarUrl={u.avatarUrl}
                      />
                      <span className="flex flex-col items-start truncate">
                        <span className="text-sm font-medium leading-tight truncate">
                          {u.username || u.email}
                        </span>
                        <span className="text-[10px] text-gray-500 leading-tight">
                          NEW • Tap to start chat
                        </span>
                      </span>
                    </span>
                    <span className="ml-auto inline-block text-[10px] bg-cyan-600 text-white px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  </button>
                </li>
              ))}
            {!remoteLoading &&
              !remoteError &&
              directQuery.trim() &&
              newUserResults.length === 0 && (
                <li className="text-xs text-gray-500 px-2 py-1">
                  No new users found
                </li>
              )}
          </ul>
        </>
      )}
      {tab === "direct" && (
        <button
          onClick={() => onStartDm && onStartDm()}
          className="mt-2 w-full text-sm bg-cyan-600 text-white py-2 rounded hover:bg-cyan-700"
        >
          + Start DM
        </button>
      )}
      <Link
        to="/"
        className="mt-4 text-xs text-gray-500 hover:underline text-center"
      >
        Back
      </Link>
    </aside>
  );
};

export default Sidebar;
