const jwt = require("jsonwebtoken");
const User = require("../models/user");
const redisClient = require("../config/redis");

/**
 * Middleware to verify JWT cookie and check Redis blocklist
 */
const userMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        // 1. Verify JWT
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        
        // 2. Find User
        const userData = await User.findById(payload._id);
        if (!userData) {
            return res.status(401).json({ message: "Unauthorized: User not found" });
        }

        // 3. Check Redis for Blocklisted token
        const isBlocked = await redisClient.exists(`token:${token}`);
        if (isBlocked) {
            return res.status(401).json({ message: "Unauthorized: Token invalidated" });
        }

        // Attach user to request
        req.user = userData;
        next();
    } catch (err) {
        res.status(401).json({ message: "Session Expired. Please login again." });
    }
};

module.exports = userMiddleware;