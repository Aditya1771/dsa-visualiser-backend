const express = require("express");
const { register, login, logout, googleLogin } = require("../controllers/authController");
const { updateAlgorithmProgress, updateProfile ,deleteProfile} = require("../controllers/userController");
const userMiddleware = require("../middleware/userMiddleware");

const router = express.Router();

/**
 * Public Routes
 */
router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);

/**
 * Private Routes
 */
router.post("/logout", userMiddleware, logout);

router.patch("/complete-algo", userMiddleware, updateAlgorithmProgress);
router.patch("/profile/update", userMiddleware, updateProfile);
router.delete("/profile/delete", userMiddleware, deleteProfile);

// Verify authentication status on app refresh
router.get("/check", userMiddleware, (req, res) => {
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
    res.status(200).json({ user: getFormattedUser(req.user) });
});

module.exports = router;