import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (!email || !token) {
      setError("Invalid reset link");
    }
  }, [email, token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await axios.post("http://localhost:5000/api/auth/reset-password", {
        email,
        token,
        password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.msg || "Reset failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Choose New Password"
      subtitle="Enter and confirm your new password."
      accent="cyan"
    >
      {success ? (
        <div className="space-y-4">
          <p className="text-sm text-green-600">
            Password reset successful. Redirecting to login...
          </p>
          <Link to="/login" className="text-cyan-600 hover:underline text-sm">
            Go to login now
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              required
              minLength={6}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          <div>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm Password"
              required
              minLength={6}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 disabled:opacity-60 text-white font-semibold py-2 rounded-lg hover:bg-cyan-700 transition"
          >
            {submitting ? "Updating..." : "Reset Password"}
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

export default ResetPassword;
