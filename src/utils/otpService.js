const crypto = require("crypto");
const bcrypt = require("bcrypt");
const redisClient = require("../config/redis");

const OTP_TTL = Number(process.env.OTP_TTL_SECONDS) || 600;          // 10 min
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const RESEND_COOLDOWN = Number(process.env.OTP_RESEND_COOLDOWN) || 60; // 60 s

// Key helpers
const otpKey = (email, purpose) => `otp:${purpose}:${email.toLowerCase()}`;
const cooldownKey = (email, purpose) =>
    `otp:cooldown:${purpose}:${email.toLowerCase()}`;

/**
 * Generate a 6-digit OTP, store its hash in Redis, return the plain OTP.
 * Enforces a resend cooldown.
 */
const generateAndStoreOtp = async (email, purpose = "signup") => {
    const cdKey = cooldownKey(email, purpose);
    const onCooldown = await redisClient.get(cdKey);
    if (onCooldown) {
        const ttl = await redisClient.ttl(cdKey);
        throw new Error(`Please wait ${ttl}s before requesting another code.`);
    }

    const otp = crypto.randomInt(100000, 1000000).toString(); // 6 digits
    const otpHash = await bcrypt.hash(otp, 10);

    const payload = JSON.stringify({ otpHash, attempts: 0 });

    await redisClient.set(otpKey(email, purpose), payload, { EX: OTP_TTL });
    await redisClient.set(cdKey, "1", { EX: RESEND_COOLDOWN });

    return otp;
};

/**
 * Verify a user-supplied OTP against the stored hash.
 * - Increments attempt counter
 * - Deletes OTP on success OR when max attempts reached
 */
const verifyOtp = async (email, otp, purpose = "signup") => {
    const key = otpKey(email, purpose);
    const raw = await redisClient.get(key);

    if (!raw) {
        throw new Error("OTP expired or not found. Please request a new one.");
    }

    const data = JSON.parse(raw);
    const isMatch = await bcrypt.compare(otp, data.otpHash);

    if (!isMatch) {
        data.attempts += 1;

        if (data.attempts >= MAX_ATTEMPTS) {
            await redisClient.del(key);
            throw new Error("Too many incorrect attempts. Please request a new OTP.");
        }

        // preserve remaining TTL
        const ttl = await redisClient.ttl(key);
        await redisClient.set(key, JSON.stringify(data), {
            EX: ttl > 0 ? ttl : OTP_TTL,
        });

        throw new Error(
            `Invalid OTP. ${MAX_ATTEMPTS - data.attempts} attempt(s) remaining.`
        );
    }

    // Success → single-use
    await redisClient.del(key);
    return true;
};

module.exports = { generateAndStoreOtp, verifyOtp };