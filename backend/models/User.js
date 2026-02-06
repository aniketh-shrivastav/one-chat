const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  },
  age: {
    type: Number,
    min: 13,
    max: 120,
    required: true,
  },
  bio: {
    type: String,
    maxlength: 280,
    default: "",
  },
  status: {
    type: String,
    enum: ["online", "away", "busy", "offline"],
    default: "offline",
    index: true,
  },
  hidePresence: {
    type: Boolean,
    default: false,
    index: true,
  },
  avatarUrl: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profile_picture: {
    type: String,
    default: "",
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorCodeHash: String,
  twoFactorCodeExpires: Date,
  passwordResetTokenHash: String,
  passwordResetExpires: Date,
});

// Password hashing before saving user
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
