const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    group_name: { type: String, required: true, trim: true },
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Keep latest message reference for quick listing (optional enhancement)
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

groupSchema.index({ group_name: 1 });
groupSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Group", groupSchema);
