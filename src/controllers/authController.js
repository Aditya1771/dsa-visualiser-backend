const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis");
const validate = require("../utils/validator"); // Import your validator
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Standard data structure for Frontend (Redux)
 */
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
    createdAt: user.createdAt
});

// --- UPDATED Register Logic ---
const register = async (req, res) => {
    try {
        // --- STEP 1: VALIDATION ---
        // This will throw an error if validation fails, jumping straight to the catch block
        validate(req.body);

        const { firstName, emailId, password } = req.body;
        
        // --- STEP 2: CHECK IF USER EXISTS ---
        const existingUser = await User.findOne({ emailId });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        // --- STEP 3: HASH PASSWORD ---
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // --- STEP 4: CREATE USER ---
        const newUser = await User.create({
            ...req.body,
            password: hashedPassword,
            role: "user"
        });

        // --- STEP 5: GENERATE TOKEN & COOKIE ---
        const token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
        res.cookie("token", token, { 
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            httpOnly: true 
        });

        res.status(201).json({ 
            user: getFormattedUser(newUser), 
            message: "Welcome to Algo Arena!" 
        });

    } catch (err) {
        // The errors thrown in validate() will be caught here
        res.status(400).json({ message: err.message });
    }
};


// --- Login Logic ---
const login = async (req, res) => {
    try {
        const { emailId, password } = req.body;
        const userData = await User.findOne({ emailId });

        if (!userData || !(await bcrypt.compare(password, userData.password))) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ _id: userData._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
        res.cookie("token", token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });

        res.status(200).json({ user: getFormattedUser(userData), message: "Login successful" });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// --- Google Sign-In Logic ---
const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const { email, given_name, family_name, picture } = ticket.getPayload();

        let userData = await User.findOne({ emailId: email });
        
        if (!userData) {
            // Auto-register Google Users
            userData = await User.create({
                firstName: given_name,
                lastName: family_name || "",
                emailId: email,
                password: "GOOGLE_AUTH_SECURE_" + Math.random(),
                profilePicture: picture ,
            });
        }

        const token = jwt.sign({ _id: userData._id }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });
        res.cookie("token", token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });

        res.status(200).json({ user: getFormattedUser(userData), message: "Google Login Successful" });
    } catch (err) {
        res.status(400).json({ message: "Google Authentication Failed" });
    }
};

// --- Logout Logic ---
const logout = async (req, res) => {
    try {
        const token = req.cookies.token;
        const payload = jwt.decode(token);

        // Add token to Redis Blocklist
        await redisClient.set(`token:${token}`, "blocked");
        await redisClient.expireAt(`token:${token}`, payload.exp);

        res.cookie("token", null, { expires: new Date(0) });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ message: "Logout Error" });
    }
};

module.exports = { register, login, logout, googleLogin };