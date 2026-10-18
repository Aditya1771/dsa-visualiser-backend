const User = require("../models/user");
const bcrypt = require("bcrypt");
const redisClient = require("../config/redis");
const validate = require("../utils/validator");
const { generateAndStoreOtp, verifyOtp } = require("../utils/otpService");
const { sendOtpEmail } = require("../utils/mailer");

/* ============================================================
   STEP 1: User submits email → send OTP if account exists
   ============================================================ */
const sendForgotPasswordOtp = async (req, res) => {
    try {
        const { emailId } = req.body;
        if (!emailId) {
            return res.status(400).json({ message: "emailId is required" });
        }

        const user = await User.findOne({ emailId });

        // SECURITY: never reveal whether the email exists
        if (!user) {
            return res.status(200).json({
                message: "If an account exists with this email, an OTP has been sent.",
            });
        }

        const otp = await generateAndStoreOtp(emailId, "forgot-password");
        await sendOtpEmail(emailId, otp, "verification");

        return res.status(200).json({
            message: "If an account exists with this email, an OTP has been sent.",
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/* ============================================================
   STEP 2: Verify OTP → issue a short-lived reset token
   ============================================================ */
const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { emailId, otp } = req.body;
        if (!emailId || !otp) {
            return res.status(400).json({ message: "emailId and otp are required" });
        }

        await verifyOtp(emailId, otp, "forgot-password");

        // Generate a one-time reset token (10 min)
        const crypto = require("crypto");
        const resetToken = crypto.randomBytes(32).toString("hex");

        await redisClient.set(
            `resetToken:${resetToken}`,
            emailId.toLowerCase(),
            { EX: 600 }
        );

        return res.status(200).json({
            message: "OTP verified. You can now reset your password.",
            resetToken,
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/* ============================================================
   STEP 3: Submit resetToken + newPassword → update password
   ============================================================ */
const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({
                message: "resetToken, newPassword, and confirmPassword are required",
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Reuse existing validator rules (length, complexity)
        validate({ firstName: "reset", emailId: "reset@ok.com", password: newPassword });

        const emailId = await redisClient.get(`resetToken:${resetToken}`);
        if (!emailId) {
            return res.status(400).json({
                message: "Reset link expired or invalid. Please start over.",
            });
        }

        const user = await User.findOne({ emailId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Single-use: burn the token
        await redisClient.del(`resetToken:${resetToken}`);

        return res.status(200).json({ message: "Password reset successful. Please log in." });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

module.exports = {
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword,
};