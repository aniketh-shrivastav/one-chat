const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { generateNumericCode, hashCode } = require("../utils/otp");
const {
  sendEmail,
  buildOtpEmail,
  buildResetEmail,
} = require("../utils/mailer");
const crypto = require("crypto");

// Multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, "..", "uploads", "avatars");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user?.id || Date.now()}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Invalid file type"));
    cb(null, true);
  },
});

// User Registration
router.post("/signup", async (req, res) => {
  const { username, email, password, name, age } = req.body;

  try {
    if (!username || !email || !password || !name || age === undefined) {
      return res
        .status(400)
        .json({ msg: "username, email, password, name, age required" });
    }
    if (String(username).length < 3) {
      return res.status(400).json({ msg: "username too short" });
    }
    if (Number.isNaN(Number(age)) || age < 13 || age > 120) {
      return res.status(400).json({ msg: "age must be between 13 and 120" });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email)
        return res.status(400).json({ msg: "Email already in use" });
      return res.status(400).json({ msg: "Username already in use" });
    }

    const newUser = new User({ username, email, password, name, age });
    await newUser.save();

    // Generate JWT
    const token = jwt.sign(
      { id: newUser._id, name: newUser.name, username: newUser.username },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    if (user.twoFactorEnabled) {
      // Issue one-time code
      const code = generateNumericCode(6);
      user.twoFactorCodeHash = hashCode(code);
      user.twoFactorCodeExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      await user.save();
      try {
        const { subject, text, html } = buildOtpEmail(code);
        await sendEmail({ to: user.email, subject, text, html });
      } catch (mailErr) {
        console.error("Failed to send 2FA code email", mailErr);
      }
      const tempToken = jwt.sign(
        { id: user._id, stage: "2fa" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.json({ requires2FA: true, tempToken });
    } else {
      const token = jwt.sign(
        { id: user._id, name: user.name, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.json({
        token,
        user: { id: user._id, name: user.name, username: user.username },
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Enable 2FA (generates & emails first code for verification to turn on) - user must verify once
router.post("/2fa/enable", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.twoFactorEnabled)
      return res.status(400).json({ msg: "Already enabled" });
    const code = generateNumericCode(6);
    user.twoFactorCodeHash = hashCode(code);
    user.twoFactorCodeExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    try {
      const { subject, text, html } = buildOtpEmail(code);
      await sendEmail({ to: user.email, subject, text, html });
    } catch (mailErr) {
      console.error("Failed to send enable 2FA email", mailErr);
    }
    res.json({ sent: true, message: "Verification code sent" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Verify 2FA enabling
router.post("/2fa/verify-enable", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.twoFactorEnabled)
      return res.status(400).json({ msg: "Already enabled" });
    if (!code) return res.status(400).json({ msg: "Code required" });
    if (!user.twoFactorCodeExpires || user.twoFactorCodeExpires < new Date())
      return res.status(400).json({ msg: "Code expired" });
    if (user.twoFactorCodeHash !== hashCode(code))
      return res.status(400).json({ msg: "Invalid code" });
    user.twoFactorEnabled = true;
    user.twoFactorCodeHash = undefined;
    user.twoFactorCodeExpires = undefined;
    await user.save();
    res.json({ enabled: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Disable 2FA
router.post("/2fa/disable", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.twoFactorEnabled = false;
    user.twoFactorCodeHash = undefined;
    user.twoFactorCodeExpires = undefined;
    await user.save();
    res.json({ disabled: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Resend 2FA login code (temp token required)
router.post("/2fa/resend", async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ msg: "tempToken required" });
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ msg: "Invalid temp token" });
    }
    if (decoded.stage !== "2fa")
      return res.status(400).json({ msg: "Not a 2FA token" });
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (!user.twoFactorEnabled)
      return res.status(400).json({ msg: "2FA not enabled" });
    const code = generateNumericCode(6);
    user.twoFactorCodeHash = hashCode(code);
    user.twoFactorCodeExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    try {
      const { subject, text, html } = buildOtpEmail(code);
      await sendEmail({ to: user.email, subject, text, html });
    } catch (mailErr) {
      console.error("Failed to resend 2FA email", mailErr);
    }
    res.json({ resent: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Verify 2FA login code
router.post("/2fa/verify", async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code)
      return res.status(400).json({ msg: "tempToken and code required" });
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ msg: "Invalid temp token" });
    }
    if (decoded.stage !== "2fa")
      return res.status(400).json({ msg: "Not a 2FA token" });
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (!user.twoFactorEnabled)
      return res.status(400).json({ msg: "2FA not enabled" });
    if (!user.twoFactorCodeExpires || user.twoFactorCodeExpires < new Date())
      return res.status(400).json({ msg: "Code expired" });
    if (user.twoFactorCodeHash !== hashCode(code))
      return res.status(400).json({ msg: "Invalid code" });
    // Success – clear code data and issue normal JWT
    user.twoFactorCodeHash = undefined;
    user.twoFactorCodeExpires = undefined;
    await user.save();
    const token = jwt.sign(
      { id: user._id, name: user.name, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({
      token,
      user: { id: user._id, name: user.name, username: user.username },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Forgot password request
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ sent: true }); // do not reveal
    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashCode(token);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15m
    await user.save();
    try {
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const { subject, text, html } = buildResetEmail({
        email,
        token,
        baseUrl,
      });
      await sendEmail({ to: email, subject, text, html });
    } catch (mailErr) {
      console.error("Failed to send password reset email", mailErr);
    }
    res.json({ sent: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password)
      return res.status(400).json({ msg: "email, token, password required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid token" });
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date())
      return res.status(400).json({ msg: "Token expired" });
    if (user.passwordResetTokenHash !== hashCode(token))
      return res.status(400).json({ msg: "Invalid token" });
    user.password = password; // will be hashed by pre-save hook if we use save()
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ reset: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Username availability (public) ?username=desired
router.get("/username-available", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== "string") {
      return res
        .status(400)
        .json({ available: false, msg: "username required" });
    }
    const trimmed = username.trim();
    if (trimmed.length < 3)
      return res.json({ available: false, msg: "Too short" });
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
      return res.json({ available: false, msg: "Invalid format" });
    const existing = await User.findOne({ username: trimmed });
    if (existing) return res.json({ available: false });
    return res.json({ available: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ available: false, msg: "Server error" });
  }
});

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "username name age email bio status avatarUrl profile_picture hidePresence"
    );
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Update current user profile (partial)
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const allowed = [
      "username",
      "name",
      "age",
      "bio",
      "status",
      "avatarUrl",
      "hidePresence",
    ]; // added hidePresence toggle
    const updates = {};
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });
    if (updates.username) {
      if (
        typeof updates.username !== "string" ||
        updates.username.trim().length < 3
      )
        return res
          .status(400)
          .json({ msg: "Username must be at least 3 characters" });
      if (!/^[a-zA-Z0-9_]+$/.test(updates.username))
        return res
          .status(400)
          .json({ msg: "Username can contain letters, numbers, underscore" });
      updates.username = updates.username.trim();
      const existing = await User.findOne({
        username: updates.username,
        _id: { $ne: req.user.id },
      });
      if (existing)
        return res.status(400).json({ msg: "Username already taken" });
    }
    if (updates.name && updates.name.trim().length < 2)
      return res.status(400).json({ msg: "Name too short" });
    if (updates.age !== undefined) {
      const n = Number(updates.age);
      if (Number.isNaN(n) || n < 13 || n > 120)
        return res.status(400).json({ msg: "Invalid age" });
    }
    if (updates.bio && updates.bio.length > 280)
      return res.status(400).json({ msg: "Bio too long" });
    if (
      updates.status &&
      !["online", "away", "busy", "offline"].includes(updates.status)
    )
      return res.status(400).json({ msg: "Invalid status" });
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      select:
        "username name age email bio status avatarUrl profile_picture hidePresence",
    });
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
// Upload avatar (multipart/form-data, field: avatar)
router.post(
  "/me/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
      const rel = `/uploads/avatars/${req.file.filename}`.replace(/\\/g, "/");
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatarUrl: rel },
        {
          new: true,
          select:
            "username name age email bio status avatarUrl profile_picture",
        }
      );
      res.json({ avatarUrl: user.avatarUrl, user });
    } catch (e) {
      console.error(e);
      res.status(500).json({ msg: "Upload failed" });
    }
  }
);
