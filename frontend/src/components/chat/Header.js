import React from "react";

const ChatHeader = ({ tab, activeGroup, activeUser }) => {
  return (
    <div className="border-b p-4 font-semibold flex items-center oc-surface-elevated oc-border">
      <span className="truncate oc-text-strong tracking-wide">
        {activeGroup && tab === "groups" && activeGroup.group_name}
        {activeUser &&
          tab === "direct" &&
          (activeUser.username || activeUser.email)}
        {!activeGroup && !activeUser && (
          <span className="oc-text-soft text-sm font-normal">
            {tab === "groups" ? "Select a group" : "Select a user"}
          </span>
        )}
      </span>
    </div>
  );
};

export default ChatHeader;
