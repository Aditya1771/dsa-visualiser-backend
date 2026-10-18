const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("@langchain/pinecone");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");

// Configuration
const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-2",
});

const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-1.5-flash", 
    temperature: 0.7, 
});

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

/**
 * STEP 1: DYNAMIC QUIZ GENERATION (RAG)
 * Fetches documentation from Pinecone and generates a fresh quiz.
 */
exports.createAIQuiz = async (algoKey) => {
    // 1. Retrieve the documentation context from Vector DB
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex });
    const docs = await vectorStore.similaritySearch(algoKey, 10);
    const context = docs.map(d => d.pageContent).join("\n\n");

    // 2. The Master Prompt for Quiz Generation
    const quizTemplate = PromptTemplate.fromTemplate(`
        You are a World-Class Computer Science Professor at AlgaArena. 
        Your task is to generate a highly technical and accurate quiz for the algorithm: {algoKey}.
        
        Using the following Documentation Context, create 10 unique and challenging questions:
        ---
        {context}
        ---

        REQUIREMENTS:
        1. Mix of types: Include 'mcq', 'fill_in_the_blank', and 'coding_error'.
        2. Difficulty: Mix 'Easy', 'Medium', and 'Hard'.
        3. Format: You MUST return ONLY a valid JSON Array. No markdown code blocks, no backticks, no text before or after the JSON.
        
        JSON SCHEMA PER QUESTION:
        {{
            "id": "A unique string (e.g. {algoKey}_AI_01)",
            "type": "mcq" | "fill_in_the_blank" | "coding_error",
            "level": "Easy" | "Medium" | "Hard",
            "question": "The question text",
            "options": ["Option A", "Option B", "Option C", "Option D"], // Required for mcq, empty array otherwise
            "answer": "The exact correct string",
            "explanation": "A concise 1-sentence explanation to be used as base context"
        }}

        Output the JSON array now:
    `);

    const chain = RunnableSequence.from([quizTemplate, model, new StringOutputParser()]);

    const response = await chain.invoke({
        algoKey: algoKey,
        context: context
    });

    try {
        // Clean and Parse JSON
        const cleanJson = response.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        console.error("Failed to parse AI Quiz JSON:", err);
        throw new Error("AI generated an invalid quiz format.");
    }
};

/**
 * STEP 2: SEMANTIC RETRIEVAL (Your Existing Logic)
 * Fetches pre-indexed questions from Pinecone.
 */
exports.retrieveQuestions = async (algoKey) => {
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex });
    const results = await vectorStore.similaritySearch(algoKey, 20);

    return results.map(doc => ({
        id: doc.metadata.id,
        type: doc.metadata.type,
        level: doc.metadata.level,
        question: doc.pageContent.split("Question: ")[1].split("Options: ")[0].trim(),
        options: doc.metadata.type === "mcq" ? doc.pageContent.split("Options: ")[1].split("Answer: ")[0].split(", ") : [],
        answer: doc.metadata.answer
    }));
};

/**
 * STEP 3: EVALUATION & EXPLANATION (GENERATION)
 * Uses the algorithm context to explain 'Why' an answer is correct.
 */
exports.generateAIDeepDive = async (questionText, correctAnswer, briefExplanation) => {
    const template = PromptTemplate.fromTemplate(`
        You are the AlgoArena Technical Tutor. 
        
        A student is reviewing the following quiz result:
        Question: {q}
        Correct Answer: {a}
        Brief Context: {e}

        Task: Provide a detailed 3-sentence technical deep-dive explanation. 
        Focus on the logical mechanics of the algorithm and its Big O complexity. 
        Be professional, technical, and encouraging.
    `);

    const chain = RunnableSequence.from([template, model, new StringOutputParser()]);
    
    return await chain.invoke({
        q: questionText,
        a: correctAnswer,
        e: briefExplanation
    });
};