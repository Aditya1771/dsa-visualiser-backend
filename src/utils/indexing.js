const fs = require('fs');
const { Document } = require("@langchain/core/documents");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("@langchain/pinecone");
require('dotenv').config();

/**
 * SEMANTIC INDEXING PHASE:
 * Treats every individual question as a unique document.
 */
async function indexing() {
    try {
        console.log("Step 1: Reading JSON data...");
        // Assuming your data is saved as 'quizzes.json'
        const rawData = fs.readFileSync("./quizes.json", "utf8");
        const algoData = JSON.parse(rawData);

        console.log("Step 2: Processing questions into atomic chunks...");
        const docs = [];

        algoData.forEach((algo) => {
            algo.questions.forEach((q) => {
                // We create a string representation of the question for the embedding
                const pageContent = `
                    Algorithm: ${algo.algo_key}
                    Question ID: ${q.id}
                    Type: ${q.type}
                    Level: ${q.level}
                    Question: ${q.question}
                    Options: ${q.options ? q.options.join(", ") : "N/A"}
                    Answer: ${q.answer}
                    Explanation: ${q.explanation}
                `.trim();

                // We store the structured data in metadata for easy retrieval
                docs.push(new Document({
                    pageContent: pageContent,
                    metadata: {
                        id: q.id,
                        algo_key: algo.algo_key,
                        type: q.type,
                        level: q.level,
                        answer: q.answer
                    }
                }));
            });
        });

        console.log(`Successfully prepared ${docs.length} questions for indexing.`);

        console.log("Step 3: Initializing Google Gemini Embeddings...");
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-embedding-2",
        });

        console.log("Step 4: Connecting to Pinecone...");
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

        // Clear existing index if you want a fresh start
        // await pineconeIndex.deleteAll(); 

        console.log("Step 5: Storing Question-Wise Chunks in Vector Database...");
        // We upload in chunks of 100 to avoid payload limits
        for (let i = 0; i < docs.length; i += 100) {
            const chunk = docs.slice(i, i + 100);
            await PineconeStore.fromDocuments(chunk, embeddings, { pineconeIndex });
            console.log(`Indexed ${i + chunk.length} / ${docs.length} questions...`);
        }

        console.log("✅ SUCCESS: Every question is now indexed as a standalone unit!");
    } catch (err) {
        console.error("❌ ERROR during indexing:", err);
    }
}

indexing();