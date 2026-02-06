import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("credentials"); // 'credentials' | 'otp'
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [tempToken, setTempToken] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const firstInvalidRef = useRef(null);

  const { email, password } = formData;

  const validators = {
    email: (value) => {
      if (!value) return "Email is required";
      // Simple RFC5322-ish pattern for demo purposes
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value)) return "Enter a valid email address";
      return "";
    },
    password: (value) => {
      if (!value) return "Password is required";
      if (value.length < 6) return "Password must be at least 6 characters";
      return "";
    },
  };

  const validateField = (name, value) => {
    const message = validators[name] ? validators[name](value) : "";
    setErrors((prev) => ({ ...prev, [name]: message }));
    return message;
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) validateField(name, value);
  };

  const onBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const runFullValidation = () => {
    const currentErrors = {};
    Object.keys(formData).forEach((field) => {
      const msg = validateField(field, formData[field]);
      if (msg && !firstInvalidRef.current) firstInvalidRef.current = field;
      if (msg) currentErrors[field] = msg;
    });
    return currentErrors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (stage === "otp") {
      return verifyOtp();
    }
    firstInvalidRef.current = null;
    setSubmitting(true);
    const validationResult = runFullValidation();
    const hasErrors = Object.values(validationResult).some(Boolean);
    if (hasErrors) {
      setSubmitting(false);
      // focus first invalid field
      setTimeout(() => {
        if (firstInvalidRef.current) {
          const el = document.querySelector(
            `[name="${firstInvalidRef.current}"]`
          );
          if (el) el.focus();
        }
      }, 0);
      return;
    }
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/login",
        formData
      );
      if (res.data.requires2FA) {
        setTempToken(res.data.tempToken);
        setStage("otp");
        setSubmitting(false);
        startResendCooldown();
        return;
      }
      localStorage.setItem("token", res.data.token);
      navigate("/chat");
    } catch (err) {
      console.error(err);
      alert("Invalid credentials");
      setSubmitting(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(30); // 30 seconds
    let remaining = 30;
    const interval = setInterval(() => {
      remaining -= 1;
      setResendCooldown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    setOtpError("");
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/2fa/verify",
        {
          tempToken,
          code: otp,
        }
      );
      localStorage.setItem("token", res.data.token);
      navigate("/chat");
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.msg || "Verification failed";
      setOtpError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await axios.post("http://localhost:5000/api/auth/2fa/resend", {
        tempToken,
      });
      startResendCooldown();
    } catch (err) {
      console.error(err);
      setOtpError("Could not resend code");
    }
  };

  const restartLogin = () => {
    setStage("credentials");
    setTempToken(null);
    setOtp("");
    setOtpError("");
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to continue your conversations."
      accent="cyan"
    >
      {stage === "credentials" && (
        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-4"
          aria-describedby="formErrors"
        >
          <div>
            <input
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="Email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                errors.email && touched.email
                  ? "border-red-500 ring-red-200"
                  : ""
              }`}
              required
              inputMode="email"
              autoComplete="email"
            />
            {errors.email && touched.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>
          <div>
            <input
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="Password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                errors.password && touched.password
                  ? "border-red-500 ring-red-200"
                  : ""
              }`}
              required
              autoComplete="current-password"
              minLength={6}
            />
            {errors.password && touched.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600">
                {errors.password}
              </p>
            )}
            <div className="mt-1 text-right">
              <Link
                to="/forgot-password"
                className="text-xs text-cyan-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg hover:bg-cyan-700 transition duration-300 shadow-sm"
          >
            {submitting ? "Validating..." : "Login"}
          </button>
        </form>
      )}
      {stage === "otp" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="text-sm text-gray-700 dark:text-slate-300">
            Enter the 6-digit code we sent to your email.
          </div>
          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setOtp(v);
              }}
              placeholder="123456"
              className="tracking-widest text-center text-lg w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-describedby={otpError ? "otp-error" : undefined}
              aria-invalid={!!otpError}
            />
            {otpError && (
              <p id="otp-error" className="mt-1 text-sm text-red-600">
                {otpError}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={resendCooldown > 0}
              onClick={resendCode}
              className="text-cyan-600 disabled:opacity-40 hover:underline"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
            </button>
            <button
              type="button"
              onClick={restartLogin}
              className="text-gray-500 hover:underline"
            >
              Start over
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg hover:bg-cyan-700 transition duration-300 shadow-sm"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>
        </form>
      )}
      <p className="text-center text-gray-600 dark:text-slate-300 mt-2 text-sm">
        Don’t have an account?{" "}
        <Link to="/signup" className="text-cyan-600 hover:underline">
          Sign Up
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
