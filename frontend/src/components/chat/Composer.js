import React from "react";

const Composer = ({ input, setInput, onSend, disabled, onPickFile }) => {
  if (disabled) return null;
  return (
    <form
      onSubmit={onSend}
      className="p-4 border-t flex gap-2 oc-surface-elevated"
    >
      <label className="inline-flex items-center px-3 py-2 border rounded bg-white hover:bg-gray-50 cursor-pointer text-sm dark:bg-slate-700 dark:border-slate-600">
        <span>Attach</span>
        <input
          type="file"
          className="hidden"
          onChange={(e) =>
            onPickFile && onPickFile(e.target.files?.[0] || null)
          }
        />
      </label>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-300 dark:bg-slate-700 dark:border-slate-600"
        placeholder="Type a message"
      />
      <button
        type="submit"
        className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700"
      >
        Send
      </button>
    </form>
  );
};

export default Composer;
