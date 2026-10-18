const User = require("../models/user");
const aiService = require("../utils/aiService");
const redisClient = require("../config/redis");

const getQuiz = async (req, res) => {
    try {
        const { algoKey } = req.params;
        const cacheKey = `quiz:${algoKey}`;

        const cached = await redisClient.get(cacheKey);
        if (cached) return res.status(200).json(JSON.parse(cached));

        const questions = await aiService.generateQuizData(algoKey);
        await redisClient.set(cacheKey, JSON.stringify(questions), 'EX', 86400);

        res.status(200).json(questions);
    } catch (err) {
        res.status(500).json({ message: "AI failed to generate quiz", error: err.message });
    }
};

const evaluateQuiz = async (req, res) => {
    try {
        const { algoKey, userAnswers } = req.body;
        const userId = req.user._id;

        const cachedData = await redisClient.get(`quiz:${algoKey}`);
        if (!cachedData) return res.status(404).json({ message: "Session expired" });
        const questions = JSON.parse(cachedData);

        const context = await aiService.getKnowledgeContext(algoKey);
        let correctCount = 0;
        const feedback = [];

        for (let q of questions) {
            const userChoice = userAnswers.find(ua => ua.id === q.id);
            const isCorrect = userChoice && userChoice.selected === q.answer;
            if (isCorrect) correctCount++;

            const deepDive = await aiService.getDetailedExplanation(q, context);
            feedback.push({
                question: q.question,
                isCorrect,
                correctAnswer: q.answer,
                userSelected: userChoice ? userChoice.selected : "Not Answered",
                explanation: deepDive
            });
        }

        const score = Math.round((correctCount / questions.length) * 100);
        let reward = { points: 0, streak: 0 };

        if (score >= 70) {
            const user = await User.findById(userId);
            reward.points = 50;
            user.totalPoints += 50;

            const today = new Date().setHours(0, 0, 0, 0);
            const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).setHours(0,0,0,0) : null;
            
            if (!lastActive) user.currentStreak = 1;
            else {
                const diffDays = (today - lastActive) / (1000 * 60 * 60 * 24);
                if (diffDays === 1) user.currentStreak += 1;
                else if (diffDays > 1) user.currentStreak = 1;
            }
            if (user.currentStreak > user.longestStreak) user.longestStreak = user.currentStreak;
            user.lastActiveDate = new Date();
            reward.streak = user.currentStreak;
            await user.save();
        }

        res.status(200).json({ score, results: feedback, reward });
    } catch (err) {
        res.status(500).json({ message: "Evaluation Error", error: err.message });
    }
};

// IMPORTANT: Make sure these names match your routes!
module.exports = { 
    getQuiz, 
    evaluateQuiz 
};