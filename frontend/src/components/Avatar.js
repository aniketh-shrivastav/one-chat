import React from "react";

const colorClasses = [
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-fuchsia-600",
  "bg-amber-600",
];

function hashToIndex(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % colorClasses.length;
}

export const Avatar = ({
  size = 40,
  name = "?",
  avatarUrl,
  className = "",
}) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  const bg = colorClasses[hashToIndex(name)];
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover shadow ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full text-white font-semibold flex items-center justify-center shadow ${bg} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {initials || "?"}
    </div>
  );
};

export default Avatar;
