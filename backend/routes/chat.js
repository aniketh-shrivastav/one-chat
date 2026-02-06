const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Message = require("../models/Message");
const Group = require("../models/Group");
const User = require("../models/User");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Helper: ensure user is member for group operations
async function ensureGroupMember(groupId, userId) {
  const group = await Group.findById(groupId);
  if (!group) return { error: "Group not found" };
  const isMember = group.members.some((m) => m.toString() === userId);
  if (!isMember) return { error: "Not a member of this group" };
  return { group };
}

// Create group
router.post("/groups", auth, async (req, res) => {
  try {
    let { group_name, members } = req.body;
    if (!group_name)
      return res.status(400).json({ msg: "group_name required" });
    if (!Array.isArray(members)) members = [];
    // Always ensure creator is in members
    members = members.filter(Boolean).map(String);
    if (!members.includes(req.user.id)) members.push(req.user.id);
    // Validate provided members (skip if only creator)
    if (members.length > 1) {
      const users = await User.find({ _id: { $in: members } });
      if (users.length !== members.length) {
        return res
          .status(400)
          .json({ msg: "One or more members do not exist" });
      }
    }
    const group = await Group.create({
      group_name,
      members,
      createdBy: req.user.id,
      admins: [req.user.id],
    });
    const emitToUser = req.app.get("emitToUser");
    members.forEach((uid) => emitToUser(uid, "group:new", group));
    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Add member to group
router.post("/groups/:groupId/members", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const { group, error } = await ensureGroupMember(groupId, req.user.id);
    if (error) return res.status(403).json({ msg: error });
    if (!userId) return res.status(400).json({ msg: "userId required" });
    if (group.members.some((m) => m.toString() === userId)) {
      return res.status(200).json(group); // already a member
    }
    group.members.push(userId);
    await group.save();
    const emitToUser = req.app.get("emitToUser");
    group.members.forEach((uid) => emitToUser(uid, "group:updated", group));
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Add member by username
router.post("/groups/:groupId/members/by-username", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;
    if (!username) return res.status(400).json({ msg: "username required" });
    const { group, error } = await ensureGroupMember(groupId, req.user.id);
    if (error) return res.status(403).json({ msg: error });
    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ msg: "User not found" });
    if (group.members.some((m) => m.toString() === target._id.toString())) {
      return res.json(group); // already member
    }
    group.members.push(target._id);
    await group.save();
    const emitToUser = req.app.get("emitToUser");
    group.members.forEach((uid) => emitToUser(uid, "group:updated", group));
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Leave group
router.post("/groups/:groupId/leave", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });
    const wasMember = group.members.some((m) => m.toString() === req.user.id);
    if (!wasMember) return res.status(400).json({ msg: "Not a member" });
    group.members = group.members.filter((m) => m.toString() !== req.user.id);
    group.admins = (group.admins || []).filter(
      (a) => a.toString() !== req.user.id
    );
    await group.save();
    const emitToUser = req.app.get("emitToUser");
    group.members.forEach((uid) => emitToUser(uid, "group:updated", group));
    res.json({ left: true, group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Promote to admin (only existing admin)
router.post("/groups/:groupId/promote", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });
    if (!group.admins.some((a) => a.toString() === req.user.id))
      return res.status(403).json({ msg: "Only admins can promote" });
    if (!group.members.some((m) => m.toString() === userId))
      return res.status(400).json({ msg: "User not a member" });
    if (!group.admins.some((a) => a.toString() === userId)) {
      group.admins.push(userId);
      await group.save();
      const emitToUser = req.app.get("emitToUser");
      group.members.forEach((uid) => emitToUser(uid, "group:updated", group));
    }
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Update group (currently only name) – only creator or admin can edit
router.put("/groups/:groupId", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { group_name } = req.body;
    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ msg: "group_name required" });
    }
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });
    const isMember = group.members.some((m) => m.toString() === req.user.id);
    if (!isMember) return res.status(403).json({ msg: "Not a member" });
    const isCreator = group.createdBy?.toString() === req.user.id;
    const isAdmin = (group.admins || []).some(
      (a) => a.toString() === req.user.id
    );
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    group.group_name = group_name.trim();
    await group.save();
    const emitToUser = req.app.get("emitToUser");
    group.members.forEach((uid) => emitToUser(uid, "group:updated", group));
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Users list (enhanced) - for starting direct chats (include presence/avatar)
router.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find({}, "username email name avatarUrl status")
      .limit(400)
      .lean();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Search users not yet directly chatted with (exclude existing partners and self)
// GET /chat/users/search?q=term&limit=20
router.get("/users/search", auth, async (req, res) => {
  try {
    let { q = "", limit = 20 } = req.query;
    q = String(q).trim();
    limit = Math.min(~~limit || 20, 25); // cap at 25
    if (!q || q.length < 2) {
      return res.status(400).json({ msg: "q (min length 2) required" });
    }
    // Find existing direct partners to exclude
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const partnersAgg = await Message.aggregate([
      {
        $match: {
          receiverType: "User",
          $or: [{ sender: userObjectId }, { receiver: userObjectId }],
        },
      },
      {
        $project: {
          other: {
            $cond: [{ $eq: ["$sender", userObjectId] }, "$receiver", "$sender"],
          },
        },
      },
      { $group: { _id: "$other" } },
    ]);
    const partnerIds = partnersAgg.map((p) => p._id.toString());
    // Build regex (escape special chars lightly)
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    const criteria = {
      _id: { $ne: userId, $nin: partnerIds },
      $or: [{ username: regex }, { email: regex }, { name: regex }],
    };
    const results = await User.find(
      criteria,
      "username email name avatarUrl status"
    )
      .sort({ username: 1 })
      .limit(limit)
      .lean();
    res.json({ q, count: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Fetch single user (minimal) - used when a new DM partner appears via socket
router.get("/users/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(
      userId,
      "username email name avatarUrl status"
    ).lean();
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Presence summary (optional endpoint)
router.get("/presence", auth, async (req, res) => {
  try {
    const online = await User.find(
      { status: { $ne: "offline" }, hidePresence: { $ne: true } },
      "_id status"
    );
    res.json(online.map((u) => ({ userId: u._id, status: u.status })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Group members detailed list
router.get("/groups/:groupId/members", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { group, error } = await ensureGroupMember(groupId, req.user.id);
    if (error) return res.status(403).json({ msg: error });
    const members = await User.find(
      { _id: { $in: group.members } },
      "username name avatarUrl status email"
    ).lean();
    res.json({ groupId, members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Unread counts per group for current user
router.get("/groups/unread-counts", auth, async (req, res) => {
  try {
    // Only messages in groups the user belongs to
    const memberGroupIds = await Group.find({ members: req.user.id }).distinct(
      "_id"
    );
    if (!memberGroupIds.length) return res.json([]);
    const raw = await Message.aggregate([
      { $match: { receiverType: "Group", receiver: { $in: memberGroupIds } } },
      {
        $group: {
          _id: "$receiver",
          unread: {
            $sum: {
              $cond: [{ $in: [req.user.id, "$readBy"] }, 0, 1],
            },
          },
        },
      },
    ]);
    const mapped = raw.map((r) => ({ groupId: r._id, unread: r.unread }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Direct unread counts per partner
router.get("/direct/unread-counts", auth, async (req, res) => {
  try {
    // Count messages where current user is the receiver and hasn't read yet
    const raw = await Message.aggregate([
      {
        $match: {
          receiverType: "User",
          receiver: new mongoose.Types.ObjectId(req.user.id),
          readBy: { $ne: req.user.id },
        },
      },
      {
        $group: {
          _id: "$sender",
          unread: { $sum: 1 },
        },
      },
    ]);
    res.json(raw.map((r) => ({ userId: r._id, unread: r.unread })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Server Error" });
  }
});

// List groups for current user
router.get("/groups", auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id }).populate(
      "lastMessage"
    );
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Send a direct message
router.post("/messages/direct", auth, async (req, res) => {
  try {
    const { toUserId, message_text } = req.body;
    if (!toUserId || !message_text)
      return res
        .status(400)
        .json({ msg: "toUserId and message_text required" });
    if (toUserId === req.user.id)
      return res.status(400).json({ msg: "Cannot message yourself" });

    const targetUser = await User.findById(toUserId);
    if (!targetUser)
      return res.status(404).json({ msg: "Recipient user not found" });

    const msg = await Message.create({
      sender: req.user.id,
      receiver: toUserId,
      receiverType: "User",
      message_text,
    });
    const emitToUser = req.app.get("emitToUser");
    // Emit to sender and receiver
    [req.user.id, toUserId].forEach((uid) =>
      emitToUser(uid, "message:new", msg)
    );
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Multer storage for chat media
const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, "..", "uploads", "media");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "application/pdf",
      "application/zip",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

function classifyAttachment(mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

// Upload a direct message attachment
router.post(
  "/messages/direct/upload",
  auth,
  uploadMedia.single("file"),
  async (req, res) => {
    try {
      const { toUserId } = req.body;
      if (!toUserId) return res.status(400).json({ msg: "toUserId required" });
      if (!req.file) return res.status(400).json({ msg: "file required" });
      if (toUserId === req.user.id)
        return res.status(400).json({ msg: "Cannot message yourself" });

      const targetUser = await User.findById(toUserId);
      if (!targetUser)
        return res.status(404).json({ msg: "Recipient user not found" });

      const url = `/uploads/media/${req.file.filename}`;
      const attachment = {
        url,
        type: classifyAttachment(req.file.mimetype),
        mime: req.file.mimetype,
        name: req.file.originalname,
        size: req.file.size,
      };
      const msg = await Message.create({
        sender: req.user.id,
        receiver: toUserId,
        receiverType: "User",
        attachment,
      });
      const emitToUser = req.app.get("emitToUser");
      [req.user.id, toUserId].forEach((uid) =>
        emitToUser(uid, "message:new", msg)
      );
      res.status(201).json(msg);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server Error" });
    }
  }
);

// Upload a group message attachment
router.post(
  "/messages/group/upload",
  auth,
  uploadMedia.single("file"),
  async (req, res) => {
    try {
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ msg: "groupId required" });
      if (!req.file) return res.status(400).json({ msg: "file required" });
      const { group, error } = await ensureGroupMember(groupId, req.user.id);
      if (error) return res.status(403).json({ msg: error });

      const url = `/uploads/media/${req.file.filename}`;
      const attachment = {
        url,
        type: classifyAttachment(req.file.mimetype),
        mime: req.file.mimetype,
        name: req.file.originalname,
        size: req.file.size,
      };
      const msg = await Message.create({
        sender: req.user.id,
        receiver: groupId,
        receiverType: "Group",
        attachment,
        readBy: [req.user.id],
      });
      group.lastMessage = msg._id;
      await group.save();
      const emitToUser = req.app.get("emitToUser");
      group.members.forEach((uid) => emitToUser(uid, "message:new", msg));
      res.status(201).json(msg);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server Error" });
    }
  }
);
// Send a direct message by target username (for initiating first DM when user id unknown)
router.post("/messages/direct/by-username", auth, async (req, res) => {
  try {
    const { username, message_text } = req.body;
    if (!username || !message_text)
      return res
        .status(400)
        .json({ msg: "username and message_text required" });
    const targetUser = await User.findOne({ username });
    if (!targetUser)
      return res.status(404).json({ msg: "Recipient user not found" });
    if (targetUser._id.toString() === req.user.id)
      return res.status(400).json({ msg: "Cannot message yourself" });

    const msg = await Message.create({
      sender: req.user.id,
      receiver: targetUser._id,
      receiverType: "User",
      message_text,
    });
    const emitToUser = req.app.get("emitToUser");
    [req.user.id, targetUser._id.toString()].forEach((uid) =>
      emitToUser(uid, "message:new", msg)
    );
    // Return both message and partner user minimal data
    res.status(201).json({
      message: msg,
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        name: targetUser.name,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl,
        status: targetUser.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Send a group message
router.post("/messages/group", auth, async (req, res) => {
  try {
    const { groupId, message_text } = req.body;
    if (!groupId || !message_text)
      return res.status(400).json({ msg: "groupId and message_text required" });
    const { group, error } = await ensureGroupMember(groupId, req.user.id);
    if (error) return res.status(403).json({ msg: error });

    const msg = await Message.create({
      sender: req.user.id,
      receiver: groupId,
      receiverType: "Group",
      message_text,
      readBy: [req.user.id],
    });

    group.lastMessage = msg._id;
    await group.save();

    const emitToUser = req.app.get("emitToUser");
    group.members.forEach((uid) => emitToUser(uid, "message:new", msg));
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// List distinct direct message partners for current user (people they have exchanged DMs with)
router.get("/direct/partners", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const partnersAgg = await Message.aggregate([
      {
        $match: {
          receiverType: "User",
          $or: [{ sender: userObjectId }, { receiver: userObjectId }],
        },
      },
      {
        $project: {
          other: {
            $cond: [{ $eq: ["$sender", userObjectId] }, "$receiver", "$sender"],
          },
          timestamp: 1,
        },
      },
      {
        $group: {
          _id: "$other",
          lastMessageAt: { $max: "$timestamp" },
          count: { $sum: 1 },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 500 },
    ]);

    const partnerIds = partnersAgg.map((p) => p._id);
    if (partnerIds.length === 0) return res.json([]);
    const users = await User.find(
      { _id: { $in: partnerIds } },
      "username email name avatarUrl status"
    ).lean();
    const userMeta = Object.fromEntries(
      users.map((u) => [u._id.toString(), u])
    );
    const result = partnersAgg.map((p) => ({
      ...(userMeta[p._id.toString()] || { _id: p._id }),
      lastMessageAt: p.lastMessageAt,
      messageCount: p.count,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Fetch conversation between current user and another user (pagination optional)
router.get("/messages/direct/:otherUserId", auth, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const { limit = 50, before } = req.query;
    const criteria = {
      $or: [
        { sender: req.user.id, receiver: otherUserId, receiverType: "User" },
        { sender: otherUserId, receiver: req.user.id, receiverType: "User" },
      ],
    };
    if (before) criteria.timestamp = { $lt: new Date(before) };

    const messages = await Message.find(criteria)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Fetch group messages
router.get("/messages/group/:groupId", auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, before } = req.query;
    const { group, error } = await ensureGroupMember(groupId, req.user.id);
    if (error) return res.status(403).json({ msg: error });

    const criteria = { receiver: groupId, receiverType: "Group" };
    if (before) criteria.timestamp = { $lt: new Date(before) };

    const messages = await Message.find(criteria)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Mark messages as read (direct or group)
router.post("/messages/mark-read", auth, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ msg: "messageIds array required" });
    }
    const msgs = await Message.find(
      { _id: { $in: messageIds } },
      "_id receiver receiverType readBy sender"
    );
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: req.user.id }, $set: { status: "read" } }
    );
    const emitToUser = req.app.get("emitToUser");
    emitToUser(req.user.id, "messages:read", { messageIds });
    // Broadcast updated unread counts for affected conversations
    const groupIds = new Set();
    const directPartnerIds = new Set();
    msgs.forEach((m) => {
      if (m.receiverType === "Group") groupIds.add(m.receiver.toString());
      else if (m.receiverType === "User") {
        // Only unread counts for direct messages where current user was the receiver
        if (m.receiver.toString() === req.user.id) {
          directPartnerIds.add(m.sender.toString());
        }
      }
    });
    // For groups: recompute unread for current user per group and emit to self only (others unaffected by current read)
    for (const gid of groupIds) {
      const unread = await Message.countDocuments({
        receiverType: "Group",
        receiver: gid,
        readBy: { $ne: req.user.id },
      });
      emitToUser(req.user.id, "unread:update", {
        type: "group",
        id: gid,
        unread,
      });
    }
    // For directs: unread where current user is receiver and not read
    for (const pid of directPartnerIds) {
      const unread = await Message.countDocuments({
        receiverType: "User",
        sender: pid,
        receiver: req.user.id,
        readBy: { $ne: req.user.id },
      });
      emitToUser(req.user.id, "unread:update", {
        type: "direct",
        id: pid,
        unread,
      });
    }
    res.json({ updated: messageIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
