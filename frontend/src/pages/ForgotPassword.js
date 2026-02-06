import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email,
      });
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email and we'll send a reset link."
      accent="cyan"
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-slate-300">
            If that email exists, we've sent a reset link. Check your inbox.
          </p>
          <Link to="/login" className="text-cyan-600 hover:underline text-sm">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 disabled:opacity-60 text-white font-semibold py-2 rounded-lg hover:bg-cyan-700 transition"
          >
            {submitting ? "Sending..." : "Send Reset Link"}
          </button>
          <p className="text-center text-sm text-gray-600 dark:text-slate-300">
            <Link to="/login" className="text-cyan-600 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
