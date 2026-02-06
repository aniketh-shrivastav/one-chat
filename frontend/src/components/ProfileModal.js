import React, { useEffect, useState, useRef } from "react";
import api from "../utils/api";
import Avatar from "./Avatar";

const statuses = [
  { value: "online", label: "Online" },
  { value: "away", label: "Away" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

const ProfileModal = ({ open, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    usernameOriginal: "",
    name: "",
    age: "",
    bio: "",
    status: "offline",
    avatarUrl: "",
    hidePresence: false,
  });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState({
    state: "idle",
    available: null,
    msg: "",
  });
  const usernameDebounceRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("avatar", f);
      const res = await api.post("/auth/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((p) => ({ ...p, avatarUrl: res.data.avatarUrl }));
      onSaved && onSaved(res.data.user);
    } catch (err) {
      setError(err?.response?.data?.msg || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      api
        .get("/auth/me")
        .then((res) => {
          const { username, name, age, bio, status, avatarUrl, hidePresence } =
            res.data;
          setForm({
            username: username || "",
            usernameOriginal: username || "",
            name: name || "",
            age: age || "",
            bio: bio || "",
            status: status || "offline",
            avatarUrl: avatarUrl || "",
            hidePresence: !!hidePresence,
          });
        })
        .catch(() => setError("Unable to load profile"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const updateField = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (name === "username") {
      setUsernameStatus({ state: "typing", available: null, msg: "" });
      if (usernameDebounceRef.current)
        clearTimeout(usernameDebounceRef.current);
      usernameDebounceRef.current = setTimeout(() => {
        checkUsername(value);
      }, 500);
    }
  };

  const checkUsername = async (value) => {
    const candidate = (value || "").trim();
    if (!candidate) {
      setUsernameStatus({ state: "idle", available: null, msg: "" });
      return;
    }
    if (candidate.length < 3) {
      setUsernameStatus({
        state: "invalid",
        available: false,
        msg: "Too short",
      });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(candidate)) {
      setUsernameStatus({
        state: "invalid",
        available: false,
        msg: "Invalid format",
      });
      return;
    }
    if (candidate === form.usernameOriginal) {
      setUsernameStatus({ state: "unchanged", available: true, msg: "" });
      return;
    }
    setUsernameStatus({ state: "checking", available: null, msg: "" });
    try {
      const res = await api.get(
        `/auth/username-available?username=${encodeURIComponent(candidate)}`
      );
      if (res.data.available) {
        setUsernameStatus({ state: "available", available: true, msg: "" });
      } else {
        setUsernameStatus({
          state: "taken",
          available: false,
          msg: res.data.msg || "Taken",
        });
      }
    } catch (err) {
      setUsernameStatus({
        state: "error",
        available: false,
        msg: "Error checking",
      });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { usernameOriginal, ...rest } = form;
      const payload = { ...rest, age: Number(rest.age) };
      // Basic client-side username validation if editing is enabled
      if (
        payload.username &&
        (payload.username.length < 3 ||
          !/^[-_a-zA-Z0-9]+$/.test(payload.username))
      ) {
        setError("Username must be 3+ chars and alphanumeric/underscore");
        setSaving(false);
        return;
      }
      if (
        usernameStatus.available === false &&
        payload.username !== usernameOriginal
      ) {
        setError("Username not available");
        setSaving(false);
        return;
      }
      const res = await api.put("/auth/me", payload);
      onSaved && onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.msg || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white dark:oc-surface-alt dark:text-slate-100 rounded-2xl shadow-xl overflow-hidden border oc-border">
        <div className="flex items-center justify-between px-6 py-4 border-b oc-border bg-gradient-to-r from-cyan-600 to-indigo-600 text-white">
          <h3 className="font-semibold">Your Profile</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-sm"
            aria-label="Close profile"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={save}
          className="p-6 space-y-5 max-h-[75vh] overflow-y-auto oc-scrollbars"
        >
          {loading && <p className="text-sm text-gray-500">Loading...</p>}
          {!loading && (
            <>
              <div className="flex items-center gap-4">
                <Avatar
                  name={form.name || "?"}
                  avatarUrl={form.avatarUrl}
                  size={72}
                />
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                      Username
                    </label>
                    <div className="relative" aria-live="polite">
                      <input
                        name="username"
                        value={form.username}
                        onChange={updateField}
                        placeholder="username"
                        minLength={3}
                        className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-24 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 ${
                          ["taken", "invalid", "error"].includes(
                            usernameStatus.state
                          )
                            ? "border-red-500 dark:border-red-500"
                            : ""
                        }`}
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 right-2 text-[11px] font-medium select-none">
                        {usernameStatus.state === "checking" && (
                          <span className="text-gray-400 dark:text-slate-400 animate-pulse">
                            Checking…
                          </span>
                        )}
                        {usernameStatus.state === "available" && (
                          <span className="text-green-600">Available</span>
                        )}
                        {usernameStatus.state === "taken" && (
                          <span className="text-red-600">Taken</span>
                        )}
                        {usernameStatus.state === "invalid" && (
                          <span className="text-red-500">Invalid</span>
                        )}
                        {usernameStatus.state === "error" && (
                          <span className="text-red-500">Error</span>
                        )}
                        {usernameStatus.state === "unchanged" && (
                          <span className="text-gray-400">Unchanged</span>
                        )}
                      </div>
                      {usernameStatus.msg &&
                        ![
                          "available",
                          "unchanged",
                          "idle",
                          "typing",
                          "checking",
                        ].includes(usernameStatus.state) && (
                          <p className="mt-1 text-[11px] text-red-600">
                            {usernameStatus.msg}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Upload Avatar
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="w-full text-xs mb-2"
                      disabled={uploading}
                    />
                    {uploading && (
                      <p className="text-[11px] text-gray-500 mb-1">
                        Uploading...
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Avatar URL
                    </label>
                    <input
                      name="avatarUrl"
                      value={form.avatarUrl}
                      onChange={updateField}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Name
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={updateField}
                      required
                      minLength={2}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Age
                    </label>
                    <input
                      name="age"
                      type="number"
                      min={13}
                      max={120}
                      value={form.age}
                      onChange={updateField}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={updateField}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
                    >
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={form.bio}
                      onChange={updateField}
                      rows={3}
                      maxLength={280}
                      placeholder="A little about you..."
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 text-right">
                      {form.bio.length}/280
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <input
                      id="hidePresence"
                      type="checkbox"
                      name="hidePresence"
                      checked={form.hidePresence}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          hidePresence: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <label
                      htmlFor="hidePresence"
                      className="text-xs text-gray-700"
                    >
                      Hide my online status from others
                    </label>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium shadow hover:bg-cyan-700 disabled:opacity-50"
                  disabled={
                    saving ||
                    ["taken", "invalid", "error"].includes(usernameStatus.state)
                  }
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
