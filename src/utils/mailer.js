const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOtpEmail = async (toEmail, otp, purpose = "verification") => {
    const subject =
        purpose === "signup"
            ? "Verify your Algo Arena account"
            : purpose === "login"
            ? "Your Algo Arena login code"
            : "Your Algo Arena verification code";

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;
                    border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#111;">Algo Arena</h2>
            <p>Your one-time code is:</p>
            <h1 style="letter-spacing:6px;color:#2563eb;margin:16px 0;">${otp}</h1>
            <p>This code expires in <b>${Math.floor((process.env.OTP_TTL_SECONDS || 600) / 60)} minutes</b>.</p>
            <p style="color:#888;font-size:12px;">If you didn't request this, ignore this email.</p>
        </div>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject,
        html,
    });
};

module.exports = { sendOtpEmail };