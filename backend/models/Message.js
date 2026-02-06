const mongoose = require("mongoose");

// Message model supports direct user-to-user and group messages.
// receiverType discriminates whether receiver refers to a User or Group.
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "receiverType",
    },
    receiverType: { type: String, required: true, enum: ["User", "Group"] },
    message_text: { type: String, trim: true },
    attachment: {
      url: String, // /uploads/media/...
      type: {
        type: String,
        enum: ["image", "video", "audio", "file"],
      },
      mime: String,
      name: String,
      size: Number,
      width: Number,
      height: Number,
      duration: Number,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: "timestamp", updatedAt: "updated_at" } }
);

// Ensure either text or attachment exists
messageSchema.pre("validate", function (next) {
  if (!this.message_text && !this.attachment) {
    return next(new Error("Message must have text or attachment"));
  }
  next();
});

messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, receiverType: 1, status: 1 });
messageSchema.index({ receiver: 1, receiverType: 1, readBy: 1 });

module.exports = mongoose.model("Message", messageSchema);
