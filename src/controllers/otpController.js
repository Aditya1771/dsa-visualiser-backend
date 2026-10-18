const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validate = require("../utils/validator");
const { generateAndStoreOtp, verifyOtp } = require("../utils/otpService");
const { sendOtpEmail } = require("../utils/mailer");

const getFormattedUser = (user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName || "",
    emailId: user.emailId,
    role: user.role,
    githubUrl: user.githubUrl || "",
    linkedinUrl: user.linkedinUrl || "",
    about: user.about || "",
    completedAlgorithms: user.completedAlgorithms || [],
    totalPoints: user.totalPoints || 0,
    currentStreak: user.currentStreak || 0,
    longestStreak: user.longestStreak || 0,
    profilePicture: user.profilePicture || "",
    badges: user.badges || [],
    notifications: user.notifications || [],
    createdAt: user.createdAt,
});

const setAuthCookie = (res, user) => {
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
    });
    res.cookie("token", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    });
};

/* ============================================================
   SIGNUP FLOW
   ============================================================ */

// Step 1: user submits name/email/password → we send OTP, don't create user yet
const sendSignupOtp = async (req, res) => {
    try {
        validate(req.body); // reuse your existing validator

        const { emailId } = req.body;

        const existingUser = await User.findOne({ emailId });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        const otp = await generateAndStoreOtp(emailId, "signup");
        await sendOtpEmail(emailId, otp, "signup");

        // Stash pending signup payload in Redis so we don't have to trust the client
        const bcryptHash = await bcrypt.hash(req.body.password, 10);
        const pending = {
            firstName: req.body.firstName,
            lastName: req.body.lastName || "",
            emailId,
            password: bcryptHash,
        };
        const redisClient = require("../config/redis");
        await redisClient.set(
            `pendingSignup:${emailId.toLowerCase()}`,
            JSON.stringify(pending),
            { EX: 900 } // 15 min to complete
        );

        res.status(200).json({ message: "OTP sent to your email. Please verify." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Step 2: user submits OTP → create account, return token
const verifySignupOtp = async (req, res) => {
    try {
        const { emailId, otp } = req.body;
        if (!emailId || !otp) {
            return res.status(400).json({ message: "emailId and otp are required" });
        }

        await verifyOtp(emailId, otp, "signup");

        const redisClient = require("../config/redis");
        const raw = await redisClient.get(`pendingSignup:${emailId.toLowerCase()}`);
        if (!raw) {
            return res
                .status(400)
                .json({ message: "Signup session expired. Please start again." });
        }

        const pending = JSON.parse(raw);

        // Double-check user wasn't created in the meantime
        const already = await User.findOne({ emailId: pending.emailId });
        if (already) {
            await redisClient.del(`pendingSignup:${emailId.toLowerCase()}`);
            return res.status(400).json({ message: "Email is already registered" });
        }

        const newUser = await User.create({
            firstName: pending.firstName,
            lastName: pending.lastName,
            emailId: pending.emailId,
            password: pending.password, // already hashed
            role: "user",
            isEmailVerified: true,
        });

        await redisClient.del(`pendingSignup:${emailId.toLowerCase()}`);

        setAuthCookie(res, newUser);

        res.status(201).json({
            user: getFormattedUser(newUser),
            message: "Welcome to Algo Arena!",
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/* ============================================================
   LOGIN FLOW (password check FIRST, then OTP)
   ============================================================ */

// Step 1: user submits email+password → password verified → send OTP
const sendLoginOtp = async (req, res) => {
    try {
        const { emailId, password } = req.body;
        if (!emailId || !password) {
            return res.status(400).json({ message: "emailId and password are required" });
        }

        const user = await User.findOne({ emailId });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const otp = await generateAndStoreOtp(emailId, "login");
        await sendOtpEmail(emailId, otp, "login");

        res.status(200).json({ message: "OTP sent to your email. Please verify." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Step 2: user submits OTP → issue JWT
const verifyLoginOtp = async (req, res) => {
    try {
        const { emailId, otp } = req.body;
        if (!emailId || !otp) {
            return res.status(400).json({ message: "emailId and otp are required" });
        }

        await verifyOtp(emailId, otp, "login");

        const user = await User.findOne({ emailId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        setAuthCookie(res, user);
        res.status(200).json({
            user: getFormattedUser(user),
            message: "Login successful",
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Optional: resend OTP (respects the cooldown inside otpService)
const resendOtp = async (req, res) => {
    try {
        const { emailId, purpose } = req.body; // purpose: "signup" | "login"
        if (!emailId || !purpose) {
            return res.status(400).json({ message: "emailId and purpose are required" });
        }

        const otp = await generateAndStoreOtp(emailId, purpose);
        await sendOtpEmail(emailId, otp, purpose);

        res.status(200).json({ message: "OTP resent successfully" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

module.exports = {
    sendSignupOtp,
    verifySignupOtp,
    sendLoginOtp,
    verifyLoginOtp,
    resendOtp,
};