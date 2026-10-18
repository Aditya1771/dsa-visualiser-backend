const User = require("../models/user");

/**
 * Updates user progress when an algorithm is completed
 */
const updateAlgorithmProgress = async (req, res) => {
    try {
        const { algoKey } = req.body; 
        const userId = req.user._id;
        const userData = await User.findById(userId);

        const isAlreadyDone = userData.completedAlgorithms.includes(algoKey);
        
        if (!isAlreadyDone) {
            userData.totalPoints += 50;
            userData.completedAlgorithms.push(algoKey);

            // --- FIXED STREAK LOGIC ---
            const today = new Date().setHours(0, 0, 0, 0);
            const lastActive = userData.lastActiveDate 
                ? new Date(userData.lastActiveDate).setHours(0, 0, 0, 0) 
                : null;

            if (!lastActive) {
                // First time ever solving
                userData.currentStreak = 1;
            } else {
                const diffTime = today - lastActive;
                const diffDays = diffTime / (1000 * 60 * 60 * 24); // Convert ms to days

                if (diffDays === 1) {
                    // 1. CONSECUTIVE: Exactly one day gap (e.g., solved yesterday, solving today)
                    userData.currentStreak += 1;
                } else if (diffDays > 1) {
                    // 2. GAP: More than one day passed (e.g., solved Monday, now is Wednesday)
                    userData.currentStreak = 1; // Reset to 1
                } 
                // 3. SAME DAY: If diffDays is 0, they already solved one today. 
                // We don't increment, we just keep the current streak.
            }

            // Update record if current streak is higher
            if (userData.currentStreak > userData.longestStreak) {
                userData.longestStreak = userData.currentStreak;
            }

            userData.lastActiveDate = new Date();
            await userData.save();
            
            return res.status(200).json({
                message: `Success! You finished ${algoKey}`,
                totalPoints: userData.totalPoints,
                currentStreak: userData.currentStreak
            });
        }

        res.status(200).json({ message: "Algorithm already completed" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Updates user profile details
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id; 
        const updates = req.body; 

        const allowedUpdates = [
            "firstName", 
            "lastName", 
            "profilePicture", 
            "about", 
            "githubUrl", 
            "linkedinUrl"
        ];

        const filteredUpdates = {};
        Object.keys(updates).forEach((key) => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: filteredUpdates },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // --- FIXED: ADDED MISSING FIELDS TO REPLY ---
        const reply = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName || "",
            emailId: user.emailId,
            role: user.role,
            profilePicture: user.profilePicture,
            // These 3 were missing in your code:
            about: user.about || "",
            githubUrl: user.githubUrl || "",
            linkedinUrl: user.linkedinUrl || "",
            // Stats
            problemSolved: user.problemSolved,
            totalPoints: user.totalPoints,
            badges: user.badges,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            notifications: user.notifications || [],
            submissionCalendar: user.submissionCalendar || {}
        };

        res.status(200).json({
            user: reply,
            message: "Profile updated successfully"
        });

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/**
 * Deletes user profile and clears session
 */
const deleteProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        await User.findByIdAndDelete(req.user._id);
        res.cookie("token", null, { expires: new Date(0) });
        res.status(200).json({ message: "Account deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { 
    updateAlgorithmProgress, 
    updateProfile, 
    deleteProfile 
};