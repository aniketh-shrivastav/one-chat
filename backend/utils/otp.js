const crypto = require("crypto");

function generateNumericCode(length = 6) {
  const max = 10 ** length;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(length, "0");
  return code;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

module.exports = { generateNumericCode, hashCode };
