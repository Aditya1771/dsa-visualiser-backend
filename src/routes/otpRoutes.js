const express = require("express");
const {
    sendSignupOtp,
    verifySignupOtp,
    sendLoginOtp,
    verifyLoginOtp,
    resendOtp,
} = require("../controllers/otpController");

const router = express.Router();

// Signup with OTP
router.post("/signup/send-otp", sendSignupOtp);
router.post("/signup/verify-otp", verifySignupOtp);

// Login with OTP
router.post("/login/send-otp", sendLoginOtp);
router.post("/login/verify-otp", verifyLoginOtp);

// Resend
router.post("/resend-otp", resendOtp);

module.exports = router;