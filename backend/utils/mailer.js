const nodemailer = require("nodemailer");

// Environment-driven configuration
// Required for real SMTP: MAIL_HOST, MAIL_USER, (MAIL_PASS), optional: MAIL_PORT (default 587), MAIL_SECURE (0/1), MAIL_FROM
// If MAIL_HOST / MAIL_USER missing we fall back to jsonTransport (safe no-op) unless MAIL_REQUIRE_SMTP=1 set (then we throw on first send).

let _transporter = null;
let _lastVerify = null;

function createTransport() {
  if (_transporter) return _transporter;
  if (process.env.MAIL_HOST && process.env.MAIL_USER) {
    _transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: !!Number(process.env.MAIL_SECURE || 0), // true => port 465 typically
      auth: process.env.MAIL_PASS
        ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
        : undefined,
    });
  } else {
    if (process.env.MAIL_REQUIRE_SMTP === "1") {
      throw new Error(
        "MAIL_REQUIRE_SMTP=1 set but MAIL_HOST / MAIL_USER not provided"
      );
    }
    _transporter = nodemailer.createTransport({ jsonTransport: true });
    console.warn(
      "[mailer] MAIL_HOST/MAIL_USER not set – using jsonTransport (emails not actually sent)"
    );
  }
  return _transporter;
}

async function verifyTransport(force = false) {
  const t = createTransport();
  if (!force && _lastVerify && Date.now() - _lastVerify < 5 * 60 * 1000) {
    return true; // cache for 5 min
  }
  try {
    await t.verify();
    _lastVerify = Date.now();
    console.log("[mailer] Transport verified");
    return true;
  } catch (err) {
    console.error("[mailer] Transport verify failed", err.message);
    return false;
  }
}

// Simple in-memory rate limit (per recipient) to avoid accidental flooding (configurable via MAIL_MAX_PER_HOUR)
const sentTimestamps = new Map(); // key: recipient, value: array of epoch ms
function canSend(to) {
  const max = Number(process.env.MAIL_MAX_PER_HOUR) || 30; // default 30/hour per address
  if (max <= 0) return true;
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const list = (sentTimestamps.get(to) || []).filter((ts) => ts > oneHourAgo);
  if (list.length >= max) return false;
  list.push(now);
  sentTimestamps.set(to, list);
  return true;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error("sendEmail: 'to' required");
  const transporter = createTransport();
  if (transporter.options.jsonTransport) {
    // jsonTransport always "succeeds"
  } else {
    // Optional verify on first real send
    await verifyTransport();
  }
  if (!canSend(to)) {
    const msg = `Rate limit exceeded for ${to}`;
    console.warn("[mailer]", msg);
    throw new Error(msg);
  }
  const from = process.env.MAIL_FROM || "no-reply@onechat.local";
  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    if (process.env.NODE_ENV !== "production") {
      console.log("[mailer] Sent mail:", info.messageId || info);
    }
    return info;
  } catch (err) {
    console.error("[mailer] send failed", err.message);
    throw err;
  }
}

function buildOtpEmail(code) {
  return {
    subject: "Your OneChat security code",
    text: `Your OneChat verification code is ${code}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your OneChat verification code is <strong style="font-size:20px; letter-spacing:4px;">${code}</strong>.</p><p>It expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
  };
}

function buildResetEmail({ email, token, baseUrl }) {
  const resetLink = `${baseUrl.replace(
    /\/$/,
    ""
  )}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  return {
    subject: "Reset your OneChat password",
    text: `Click the link to reset your password: ${resetLink}\nIf you did not request this, ignore this email. Link valid 15 minutes.`,
    html: `<p>Click the link below to reset your OneChat password (valid 15 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}
async function sendOtpEmail(to, code) {
  const { subject, text, html } = buildOtpEmail(code);
  return sendEmail({ to, subject, text, html });
}

async function sendPasswordResetEmail(to, token, baseUrl) {
  const { subject, text, html } = buildResetEmail({
    email: to,
    token,
    baseUrl,
  });
  return sendEmail({ to, subject, text, html });
}

module.exports = {
  // core
  sendEmail,
  verifyTransport,
  // builders
  buildOtpEmail,
  buildResetEmail,
  // convenience
  sendOtpEmail,
  sendPasswordResetEmail,
};
