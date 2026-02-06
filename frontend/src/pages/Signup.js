import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";

const Signup = () => {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    username: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const firstInvalidRef = useRef(null);

  const { name, age, username, email, password } = formData;

  const validators = {
    name: (value) => {
      if (!value) return "Name is required";
      if (value.trim().length < 2) return "Name must be at least 2 characters";
      return "";
    },
    age: (value) => {
      if (value === "" || value === null) return "Age is required";
      const n = Number(value);
      if (Number.isNaN(n)) return "Age must be a number";
      if (n < 13) return "Minimum age is 13";
      if (n > 120) return "Age seems invalid";
      return "";
    },
    username: (value) => {
      if (!value) return "Username is required";
      if (value.length < 3) return "Username must be at least 3 characters";
      if (!/^[a-zA-Z0-9_]+$/.test(value))
        return "Only letters, numbers and underscore allowed";
      return "";
    },
    email: (value) => {
      if (!value) return "Email is required";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value)) return "Enter a valid email address";
      return "";
    },
    password: (value) => {
      if (!value) return "Password is required";
      if (value.length < 6) return "Password must be at least 6 characters";
      if (!/[A-Z]/.test(value)) return "Include at least one uppercase letter";
      if (!/[0-9]/.test(value)) return "Include at least one number";
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
    firstInvalidRef.current = null;
    setSubmitting(true);
    const validationResult = runFullValidation();
    const hasErrors = Object.values(validationResult).some(Boolean);
    if (hasErrors) {
      setSubmitting(false);
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
      const res = await axios.post("http://localhost:5000/api/auth/signup", {
        ...formData,
        age: Number(formData.age),
      });
      localStorage.setItem("token", res.data.token);
      navigate("/chat");
    } catch (err) {
      console.error(err);
      alert("Error during signup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up and start chatting instantly with your teams."
      accent="indigo"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <input
            type="text"
            name="name"
            value={name}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Full Name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              errors.name && touched.name ? "border-red-500 ring-red-200" : ""
            }`}
            required
            minLength={2}
            autoComplete="name"
          />
          {errors.name && touched.name && (
            <p id="name-error" className="mt-1 text-sm text-red-600">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <input
            type="number"
            name="age"
            value={age}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Age"
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? "age-error" : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              errors.age && touched.age ? "border-red-500 ring-red-200" : ""
            }`}
            required
            min={13}
            max={120}
            inputMode="numeric"
          />
          {errors.age && touched.age && (
            <p id="age-error" className="mt-1 text-sm text-red-600">
              {errors.age}
            </p>
          )}
        </div>
        <div>
          <input
            type="text"
            name="username"
            value={username}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Username"
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "username-error" : undefined}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              errors.username && touched.username
                ? "border-red-500 ring-red-200"
                : ""
            }`}
            required
            minLength={3}
            autoComplete="username"
          />
          {errors.username && touched.username && (
            <p id="username-error" className="mt-1 text-sm text-red-600">
              {errors.username}
            </p>
          )}
        </div>
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
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              errors.email && touched.email ? "border-red-500 ring-red-200" : ""
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
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              errors.password && touched.password
                ? "border-red-500 ring-red-200"
                : ""
            }`}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {errors.password && touched.password && (
            <p id="password-error" className="mt-1 text-sm text-red-600">
              {errors.password}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Must be 6+ chars, include a number & uppercase letter.
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition duration-300 shadow-sm"
        >
          {submitting ? "Validating..." : "Sign Up"}
        </button>
      </form>
      <p className="text-center text-gray-600 dark:text-slate-300 mt-2 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-indigo-600 hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Signup;
