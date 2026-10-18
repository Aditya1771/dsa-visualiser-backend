const cookieParser = require("cookie-parser");
const express = require("express");
const app = express();
require("dotenv").config();
const main = require("./config/db");
const authRouter = require("./routes/userAuth");
const quizRoutes = require("./routes/quizRoutes");
const otpRouter = require("./routes/otpRoutes");
const forgotPasswordRouter = require("./routes/forgotPasswordRoutes");
const redisClient = require("./config/redis");
// const aiRouter = require("./routes/aiChattingRouter");
const cors = require('cors');



app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());

app.use(cors({
    origin : 'http://localhost:1234',
    credentials :true
}))

// routes
app.use("/user", authRouter);
app.use("/api/quiz", quizRoutes);
app.use("/auth-otp", otpRouter);
app.use("/auth-otp/forgot-password", forgotPasswordRouter);

const InitializeConnection = async () => {
    try {
        await Promise.all([main(), redisClient.connect()]);      
        console.log("Connected to the database successfully!");
        app.listen(process.env.PORT, () => {
            console.log("Server is running on port : " +process.env.PORT);
        }); 

    } catch (err) {
        console.error("Failed to connect to the database:", err);
    }
};

InitializeConnection();






