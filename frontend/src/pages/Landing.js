import React from "react";
import { Link } from "react-router-dom";

// Simple marketing / hero style landing page for OneChat
const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 text-white">
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center font-bold text-lg shadow">
            OC
          </div>
          <span className="text-xl font-semibold tracking-wide">OneChat</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="hover:text-cyan-200 transition-colors">
            Features
          </a>
          <a href="#why" className="hover:text-cyan-200 transition-colors">
            Why OneChat
          </a>
          <a href="#cta" className="hover:text-cyan-200 transition-colors">
            Get Started
          </a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 rounded-lg bg-white text-cyan-700 font-semibold shadow hover:shadow-lg transition"
          >
            Sign Up
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 pt-10 pb-24">
        <div className="flex-1">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-6">
            Real‑time conversations.
            <br /> Simple. Fast. Yours.
          </h1>
          <p className="text-white/85 text-lg max-w-xl mb-8">
            OneChat lets you spin up groups, message friends directly, share
            updates and stay in sync in a clean, distraction‑free interface.
            Built for speed and focusing on what matters: the conversation.
          </p>
          <div id="cta" className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/signup"
              className="px-6 py-3 rounded-xl bg-white text-cyan-700 font-semibold text-lg shadow hover:shadow-lg transition"
            >
              Create your account
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl border border-white/40 hover:bg-white/10 backdrop-blur-sm font-medium text-lg transition"
            >
              I already have one
            </Link>
          </div>
          <div
            id="features"
            className="mt-14 grid sm:grid-cols-3 gap-6 max-w-3xl"
          >
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <h3 className="font-semibold mb-1">Groups & Direct</h3>
              <p className="text-sm text-white/80 leading-snug">
                Effortlessly switch between focused 1‑1 chats and dynamic group
                discussions.
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <h3 className="font-semibold mb-1">Live Updates</h3>
              <p className="text-sm text-white/80 leading-snug">
                Messages appear instantly thanks to real‑time sockets – no
                reloads.
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <h3 className="font-semibold mb-1">Read Tracking</h3>
              <p className="text-sm text-white/80 leading-snug">
                Know what you’ve missed with smart unread and read‑receipt
                logic.
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full max-w-lg">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/40 to-indigo-600/40 mix-blend-overlay" />
            <img
              src="/logo512.png"
              alt="OneChat preview"
              className="w-full h-80 object-cover object-center select-none"
              draggable={false}
            />
          </div>
          <p id="why" className="mt-6 text-white/80 text-sm leading-relaxed">
            Lightweight architecture, modern UX and an extensible foundation.
            We’re just getting started—profiles, themes, media sharing and more
            are on the way.
          </p>
        </div>
      </main>
      <footer className="mt-auto py-6 text-center text-xs text-white/60">
        © {new Date().getFullYear()} OneChat. Built with React & Express.
      </footer>
    </div>
  );
};

export default Landing;
