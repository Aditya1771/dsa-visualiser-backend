const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        minLength: 3,
        maxLength: 50,
    },
    lastName: { 
        type: String,
        minLength: 3,
        maxLength: 50,
    },
    emailId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        immutable: true,
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    profilePicture: { 
        type: String 
    },
    githubUrl: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    about: { type: String, maxLength: 500, default: "" },
    
    // --- ALGO ARENA PROGRESS ---
    completedAlgorithms: {
        type: [String], // Keys from your dsaalgo.js (e.g., "Bubble-Sort")
        default: []
    },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt:     { type: Date },
    // --- GAMIFICATION & RANKING ---
    totalPoints: {
        type: Number,
        default: 0
    },
    currentStreak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastActiveDate: {
        type: Date
    },

    // --- REWARDS ---
    badges: [{
        badgeId: { 
            type: String 
        },
        unlockedAt: { 
            type: Date, 
            default: Date.now 
        }
    }],

    // --- SYSTEM ---
    notifications: [{
        title: { type: String },
        message: { type: String },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Index for high-performance leaderboard queries
userSchema.index({ totalPoints: -1 });

const User = mongoose.model("user", userSchema);
module.exports = User;