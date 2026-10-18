const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// CORRECT IMPORT for object export (Notice the { })
const userMiddleware = require("../middleware/userMiddleware"); 

router.get("/generate/:algoKey", userMiddleware, quizController.getQuiz);
router.post("/submit", userMiddleware, quizController.evaluateQuiz);

module.exports = router;