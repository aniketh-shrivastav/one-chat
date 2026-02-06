import React, { useEffect, useState, useRef } from "react";
import ProfileModal from "../components/ProfileModal";
import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/Header";
import MessageList from "../components/chat/MessageList";
import Composer from "../components/chat/Composer";
import api from "../utils/api";
import { initSocket, getSocket } from "../utils/socket";
import { clearToken, getToken } from "../utils/auth";
import { decodeToken } from "../utils/jwt";
import { Link, useNavigate } from "react-router-dom";

// Inline editor for group name (creator/admin only)
const GroupNameInlineEditor = ({ group, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(group.group_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(group.group_name);
  }, [group.group_name]);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim() || value.trim() === group.group_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.put(`/chat/groups/${group._id}`, {
        group_name: value.trim(),
      });
      onSaved && onSaved(res.data);
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.msg || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        className="text-cyan-700 dark:text-cyan-300 hover:underline"
        onClick={() => setEditing(true)}
        title="Edit group name"
      >
        Edit Name
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-white dark:bg-slate-700 dark:border-slate-600"
      />
      <button
        type="submit"
        disabled={saving || !value.trim()}
        className="text-xs px-2 py-1 rounded bg-cyan-600 text-white disabled:opacity-40"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        type="button"
        className="text-xs px-2 py-1 text-gray-500 hover:underline"
        onClick={() => {
          setEditing(false);
          setValue(group.group_name);
        }}
      >
        Cancel
      </button>
      {error && <span className="text-[10px] text-red-600 ml-1">{error}</span>}
    </form>
  );
};

const Chat = () => {
  // View state
  const [tab, setTab] = useState("groups"); // 'groups' | 'direct'

  // Groups
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Direct users (conversation partners only)
  const [users, setUsers] = useState([]);
  const [showStartDm, setShowStartDm] = useState(false);
  const [dmUsername, setDmUsername] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [startingDm, setStartingDm] = useState(false);
  const [dmError, setDmError] = useState("");
  const [activeUser, setActiveUser] = useState(null); // other user's object

  // Messages & meta
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [userMap, setUserMap] = useState({}); // id -> {name, username, email}
  const [addUsername, setAddUsername] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [membersData, setMembersData] = useState([]);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("onechat-theme") || "light"
  );

  // Apply theme class to <html> for global styling
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Unread counts
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({}); // groupId -> count
  const [directUnreadCounts, setDirectUnreadCounts] = useState({}); // userId -> count

  const messagesEndRef = useRef(null); // retained for legacy; new component has own ref
  const navigate = useNavigate();

  // Auto scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const t = getToken();
    const decoded = decodeToken(t);
    const id = decoded?.id || decoded?._id || null;
    setCurrentUserId(id);
    setCurrentUserName(decoded?.name || "");

    // Initial data fetches
    api
      .get("/chat/groups")
      .then((res) => setGroups(res.data))
      .catch(console.error);

    api
      .get("/chat/groups/unread-counts")
      .then((res) => {
        const map = {};
        res.data.forEach((r) => (map[r.groupId] = r.unread));
        setGroupUnreadCounts(map);
      })
      .catch(() => {});

    api
      .get("/chat/direct/unread-counts")
      .then((res) => {
        const map = {};
        res.data.forEach((r) => (map[r.userId] = r.unread));
        setDirectUnreadCounts(map);
      })
      .catch(() => {});

    // Fetch conversation partners instead of all users
    api
      .get("/chat/direct/partners")
      .then((res) => {
        const partners = res.data.filter((u) => u._id !== id);
        setUsers(partners);
        // Merge with any existing status/presence info instead of overwriting.
        setUserMap((prev) => {
          const merged = { ...prev };
          partners.forEach((u) => {
            merged[u._id] = { ...(merged[u._id] || {}), ...u };
          });
          if (id) {
            merged[id] = {
              ...(merged[id] || {}),
              _id: id,
              name: decoded?.name,
              username: decoded?.username,
              email: decoded?.email,
            };
          }
          return merged;
        });
      })
      .catch(() => {});

    const s = initSocket();
    if (!s) return;

    s.on("connection:ack", () => console.log("Socket connected"));
    s.on("connect_error", (err) => {
      console.error("Socket connect_error", err.message);
    });
    s.on("group:new", (group) => {
      setGroups((prev) => [group, ...prev]);
    });
    s.on("group:updated", (group) => {
      setGroups((prev) => prev.map((g) => (g._id === group._id ? group : g)));
    });
    s.on("presence:update", ({ userId, status }) => {
      setUserMap((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], status },
      }));
    });
    s.on("unread:update", ({ type, id, unread }) => {
      if (type === "group") {
        setGroupUnreadCounts((prev) => ({ ...prev, [id]: unread }));
      } else if (type === "direct") {
        setDirectUnreadCounts((prev) => ({ ...prev, [id]: unread }));
      }
    });
    s.on("message:new", (msg) => {
      if (msg.receiverType === "Group") {
        if (
          !activeGroup ||
          msg.receiver !== activeGroup._id ||
          tab !== "groups"
        ) {
          setGroupUnreadCounts((prev) => ({
            ...prev,
            [msg.receiver]: (prev[msg.receiver] || 0) + 1,
          }));
        } else {
          setMessages((prev) => [...prev, msg]);
          // Mark as read immediately for active group
          api
            .post("/chat/messages/mark-read", { messageIds: [msg._id] })
            .catch(() => {});
        }
      } else if (msg.receiverType === "User") {
        // Direct message belongs to conversation if either sender or receiver matches activeUser
        const otherPartyId =
          msg.sender === currentUserId ? msg.receiver : msg.sender;
        const isActiveConversation =
          tab === "direct" && activeUser && otherPartyId === activeUser._id;
        if (isActiveConversation) {
          setMessages((prev) => [...prev, msg]);
          api
            .post("/chat/messages/mark-read", { messageIds: [msg._id] })
            .catch(() => {});
        } else {
          setDirectUnreadCounts((prev) => ({
            ...prev,
            [otherPartyId]: (prev[otherPartyId] || 0) + 1,
          }));
          // If this partner isn't in our list yet, fetch minimal user and add
          if (!userMap[otherPartyId]) {
            api
              .get(`/chat/users/${otherPartyId}`)
              .then((r) => {
                setUsers((prev) => [r.data, ...prev]);
                setUserMap((prev) => ({ ...prev, [r.data._id]: r.data }));
              })
              .catch(() => {});
          }
        }
      }
    });

    return () => {
      if (s) s.removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?._id, activeUser?._id, tab, currentUserId]);

  const resetActive = () => {
    setMessages([]);
    setActiveGroup(null);
    setActiveUser(null);
  };

  const selectGroup = async (group) => {
    setTab("groups");
    setActiveUser(null);
    setActiveGroup(group);
    setLoadingMessages(true);
    try {
      const res = await api.get(`/chat/messages/group/${group._id}?limit=100`);
      setMessages(res.data);
      // Ensure any senders in the fetched messages are present in userMap; backend returns sender id only
      setUserMap((prev) => {
        const next = { ...prev };
        res.data.forEach((m) => {
          if (!next[m.sender]) {
            // Placeholder; will be enriched when members endpoint resolves
            next[m.sender] = { _id: m.sender };
          }
        });
        return next;
      });
      api
        .get(`/chat/groups/${group._id}/members`)
        .then((r) => {
          setMembersData(r.data.members);
          // Merge members into userMap so their names/avatar appear in messages
          setUserMap((prev) => {
            const next = { ...prev };
            r.data.members.forEach((m) => {
              if (!next[m._id]) next[m._id] = m;
              else next[m._id] = { ...next[m._id], ...m };
            });
            return next;
          });
        })
        .catch(() => {});
      const unreadIds = res.data
        .filter((m) => !(m.readBy || []).includes(currentUserId))
        .map((m) => m._id);
      if (unreadIds.length) {
        api
          .post("/chat/messages/mark-read", { messageIds: unreadIds })
          .catch(() => {});
      }
      // After marking read, fetch authoritative unread for this group to avoid stale badge
      api
        .get("/chat/groups/unread-counts")
        .then((r) => {
          const map = { ...groupUnreadCounts };
          r.data.forEach((g) => (map[g.groupId] = g.unread));
          if (!r.data.some((g) => g.groupId === group._id)) {
            map[group._id] = 0;
          }
          setGroupUnreadCounts(map);
        })
        .catch(() => {
          setGroupUnreadCounts((prev) => ({ ...prev, [group._id]: 0 }));
        });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectUser = async (user) => {
    setTab("direct");
    setActiveGroup(null);
    setActiveUser(user);
    setLoadingMessages(true);
    try {
      const res = await api.get(`/chat/messages/direct/${user._id}?limit=100`);
      setMessages(res.data);
      const unreadIds = res.data
        .filter((m) => !(m.readBy || []).includes(currentUserId))
        .map((m) => m._id);
      if (unreadIds.length) {
        api
          .post("/chat/messages/mark-read", { messageIds: unreadIds })
          .catch(() => {});
      }
      // Refresh direct unread authoritative counts
      api
        .get("/chat/direct/unread-counts")
        .then((r) => {
          const map = {};
          r.data.forEach((d) => (map[d.userId] = d.unread));
          if (!map[user._id]) map[user._id] = 0;
          setDirectUnreadCounts(map);
        })
        .catch(() => {
          setDirectUnreadCounts((prev) => ({ ...prev, [user._id]: 0 }));
        });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !pendingFile) return;
    try {
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        if (activeGroup) form.append("groupId", activeGroup._id);
        if (activeUser) form.append("toUserId", activeUser._id);
        const url = activeGroup
          ? "/chat/messages/group/upload"
          : "/chat/messages/direct/upload";
        const res = await api.post(url, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessages((prev) => [...prev, res.data]);
        setPendingFile(null);
      } else {
        if (activeGroup) {
          const res = await api.post("/chat/messages/group", {
            groupId: activeGroup._id,
            message_text: input.trim(),
          });
          setMessages((prev) => [...prev, res.data]);
        } else if (activeUser) {
          const res = await api.post("/chat/messages/direct", {
            toUserId: activeUser._id,
            message_text: input.trim(),
          });
          setMessages((prev) => [...prev, res.data]);
        }
      }
      setInput("");
    } catch (e) {
      console.error(e);
    }
  };

  const logout = () => {
    clearToken();
    const s = getSocket();
    if (s) s.disconnect();
    navigate("/login");
  };

  return (
    <div
      className={`flex h-screen oc-bg text-slate-800 dark:text-slate-100 theme-transition`}
    >
      <Sidebar
        tab={tab}
        setTab={setTab}
        resetActive={resetActive}
        groups={groups}
        users={users}
        activeGroup={activeGroup}
        activeUser={activeUser}
        selectGroup={selectGroup}
        selectUser={selectUser}
        groupUnreadCounts={groupUnreadCounts}
        directUnreadCounts={directUnreadCounts}
        onShowCreateGroup={() => {
          setShowCreateGroup(true);
          setNewGroupName("");
        }}
        onShowProfile={() => setShowProfile(true)}
        currentUserName={currentUserName}
        currentUser={userMap[currentUserId]}
        onStartDm={() => {
          setDmUsername("");
          setDmMessage("");
          setDmError("");
          setShowStartDm(true);
        }}
        onPrefillDmUsername={(uname) => {
          setDmUsername(uname);
          setDmMessage("");
          setDmError("");
          setShowStartDm(true);
          if (tab !== "direct") setTab("direct");
        }}
      />
      <main className="flex-1 flex flex-col oc-surface-alt">
        <ChatHeader
          tab={tab}
          activeGroup={activeGroup}
          activeUser={activeUser}
        />
        <div className="px-4 py-1 text-[11px] oc-text-soft flex gap-4 border-b oc-border oc-surface-elevated">
          <button
            onClick={() => {
              api.get("/chat/groups/unread-counts").then((r) => {
                const map = {};
                r.data.forEach((g) => (map[g.groupId] = g.unread));
                setGroupUnreadCounts(map);
              });
              api.get("/chat/direct/unread-counts").then((r) => {
                const map = {};
                r.data.forEach((d) => (map[d.userId] = d.unread));
                setDirectUnreadCounts(map);
              });
            }}
            className="hover:underline"
          >
            Refresh Unread
          </button>
        </div>
        {activeGroup && (
          <div className="px-4 py-1 text-xs flex items-center gap-4 oc-surface-elevated oc-border border-y">
            <button
              onClick={() => {
                setShowMembers((v) => !v);
                if (!showMembers) {
                  api
                    .get(`/chat/groups/${activeGroup._id}/members`)
                    .then((r) => setMembersData(r.data.members))
                    .catch(() => {});
                }
              }}
              className="text-cyan-700 dark:text-cyan-300 hover:underline"
            >
              Members ({activeGroup.members?.length || 0})
            </button>
            <button
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                setTheme(next);
                localStorage.setItem("onechat-theme", next);
              }}
              className="text-cyan-700 dark:text-cyan-300 hover:underline"
            >
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </button>
            <button
              onClick={logout}
              className="text-rose-600 dark:text-rose-400 hover:underline ml-auto"
            >
              Logout
            </button>
            {activeGroup &&
              (activeGroup.createdBy === currentUserId ||
                (activeGroup.admins || []).includes(currentUserId)) && (
                <GroupNameInlineEditor
                  group={activeGroup}
                  onSaved={(g) => {
                    setGroups((prev) =>
                      prev.map((x) => (x._id === g._id ? g : x))
                    );
                    setActiveGroup(g);
                  }}
                />
              )}
          </div>
        )}
        {addError && (
          <div className="px-4 pt-1 text-xs text-red-600">{addError}</div>
        )}
        {loadingMessages && (
          <p className="text-sm text-gray-500 px-4 pt-2">Loading...</p>
        )}
        {!loadingMessages &&
          messages.length === 0 &&
          (activeGroup || activeUser) && (
            <p className="text-sm text-gray-400 px-4 pt-2">No messages yet</p>
          )}
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          userMap={userMap}
        />
        <Composer
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          disabled={!activeGroup && !activeUser}
          onPickFile={(f) => setPendingFile(f)}
        />
      </main>
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="oc-surface-alt dark:oc-surface-alt rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4 border oc-border text-slate-800 dark:text-slate-100">
            <h3 className="text-lg font-semibold">Create Group</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newGroupName.trim()) return;
                setCreatingGroup(true);
                try {
                  const res = await api.post("/chat/groups", {
                    group_name: newGroupName.trim(),
                  });
                  setGroups((prev) => [res.data, ...prev]);
                  setShowCreateGroup(false);
                  setNewGroupName("");
                  selectGroup(res.data);
                } catch (err) {
                  console.error(err);
                } finally {
                  setCreatingGroup(false);
                }
              }}
              className="space-y-3"
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
                  disabled={creatingGroup}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || creatingGroup}
                  className="px-4 py-2 text-sm rounded bg-cyan-600 text-white disabled:opacity-50 hover:bg-cyan-700"
                >
                  {creatingGroup ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        onSaved={(u) =>
          setUserMap((prev) => ({ ...prev, [u._id || currentUserId]: u }))
        }
      />
      {showMembers && activeGroup && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white dark:oc-surface shadow-xl border-l oc-border flex flex-col z-40">
          <div className="p-4 border-b oc-border flex items-center justify-between">
            <h4 className="font-semibold text-sm">Group Members</h4>
            <button
              className="text-xs text-gray-500 hover:underline"
              onClick={() => setShowMembers(false)}
            >
              Close
            </button>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto flex-1 oc-scrollbars">
            {membersData.map((m) => (
              <div
                key={m._id}
                className="flex items-center gap-3 text-sm px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <span className="relative">
                  <img
                    src={m.avatarUrl || "/logo192.png"}
                    alt={m.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <span
                    className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                      m.status === "online"
                        ? "bg-emerald-500"
                        : m.status === "away"
                        ? "bg-amber-400"
                        : m.status === "busy"
                        ? "bg-rose-500"
                        : "bg-gray-300"
                    }`}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.name || m.username}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {m.username} • {m.status}
                  </p>
                </div>
              </div>
            ))}
            {membersData.length === 0 && (
              <p className="text-xs text-gray-500">No members loaded</p>
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!addUsername.trim()) return;
              setAddingMember(true);
              setAddError("");
              try {
                const res = await api.post(
                  `/chat/groups/${activeGroup._id}/members/by-username`,
                  { username: addUsername.trim() }
                );
                setGroups((prev) =>
                  prev.map((g) => (g._id === res.data._id ? res.data : g))
                );
                api
                  .get(`/chat/groups/${activeGroup._id}/members`)
                  .then((r) => setMembersData(r.data.members))
                  .catch(() => {});
                setAddUsername("");
              } catch (err) {
                setAddError(err?.response?.data?.msg || "Unable to add member");
              } finally {
                setAddingMember(false);
              }
            }}
            className="p-3 border-t flex gap-2"
          >
            <input
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="Add username"
              className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              disabled={!addUsername.trim() || addingMember}
              className="text-sm px-3 py-1 rounded bg-cyan-600 text-white disabled:opacity-40"
            >
              {addingMember ? "..." : "Add"}
            </button>
          </form>
          {addError && (
            <div className="px-3 pb-2 text-[11px] text-red-600">{addError}</div>
          )}
        </div>
      )}
      {showStartDm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">Start Direct Message</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!dmUsername.trim() || !dmMessage.trim()) return;
                setStartingDm(true);
                setDmError("");
                try {
                  const res = await api.post(
                    "/chat/messages/direct/by-username",
                    {
                      username: dmUsername.trim(),
                      message_text: dmMessage.trim(),
                    }
                  );
                  // Add partner if new
                  if (!userMap[res.data.user._id]) {
                    setUsers((prev) => [res.data.user, ...prev]);
                    setUserMap((prev) => ({
                      ...prev,
                      [res.data.user._id]: res.data.user,
                    }));
                  }
                  setShowStartDm(false);
                  setDmUsername("");
                  setDmMessage("");
                  // Open the conversation
                  selectUser(res.data.user);
                  setMessages([res.data.message]);
                } catch (err) {
                  setDmError(
                    err?.response?.data?.msg || "Unable to start conversation"
                  );
                } finally {
                  setStartingDm(false);
                }
              }}
              className="space-y-3"
            >
              <input
                value={dmUsername}
                onChange={(e) => setDmUsername(e.target.value)}
                placeholder="Username"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-300 dark:bg-slate-700 dark:border-slate-600"
              />
              <textarea
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="First message"
                rows={3}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-300 resize-none dark:bg-slate-700 dark:border-slate-600"
              />
              {dmError && <p className="text-xs text-red-600">{dmError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStartDm(false)}
                  className="px-3 py-2 text-sm rounded border hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700"
                  disabled={startingDm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !dmUsername.trim() || !dmMessage.trim() || startingDm
                  }
                  className="px-4 py-2 text-sm rounded bg-cyan-600 text-white disabled:opacity-50 hover:bg-cyan-700"
                >
                  {startingDm ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
