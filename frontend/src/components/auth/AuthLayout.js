import React from "react";
import { Link } from "react-router-dom";

const AuthLayout = ({ title, subtitle, children, accent = "cyan" }) => {
  const accentClasses = {
    cyan: {
      gradient: "from-cyan-500 via-sky-500 to-blue-600",
      ring: "focus:ring-cyan-400",
      link: "text-cyan-600 hover:text-cyan-500",
    },
    indigo: {
      gradient: "from-indigo-500 via-purple-500 to-pink-500",
      ring: "focus:ring-indigo-400",
      link: "text-indigo-600 hover:text-indigo-500",
    },
  };
  const c = accentClasses[accent] || accentClasses.cyan;
  return (
    <div
      className={`min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${c.gradient}`}
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-white/5" />
      <div className="absolute -top-40 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="relative w-full max-w-md px-8 py-10 rounded-2xl shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-white/40 dark:border-slate-700 flex flex-col gap-6 animate-fadeIn">
        <div className="flex flex-col items-center gap-2">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-white to-slate-200 dark:from-slate-800 dark:to-slate-700 shadow flex items-center justify-center text-xl font-black text-slate-700 dark:text-slate-200 group-hover:scale-105 transition">
              OC
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              OneChat
            </span>
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 text-center">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-sm">
              {subtitle}
            </p>
          )}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
