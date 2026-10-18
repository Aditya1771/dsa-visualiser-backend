const express = require("express");
const {
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword,
} = require("../controllers/forgotPasswordController");

const router = express.Router();

router.post("/send-otp", sendForgotPasswordOtp);
router.post("/verify-otp", verifyForgotPasswordOtp);
router.post("/reset", resetPassword);

module.exports = router;