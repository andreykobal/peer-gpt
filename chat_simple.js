#!/usr/bin/env node
import readline from 'readline';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import { existsSync } from 'fs';

// Check for the API key in environment variables
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    console.error("Error: Please set the OPENAI_API_KEY environment variable.");
    process.exit(1);
}

// Define the system prompt (always present)
const systemPrompt = {
    role: "system",
    content: "You are a helpful assistant."
};

// Utility to prompt for input (returns a Promise)
function promptInput(query) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Load conversation history from a file, keyed by user key.
// If no file exists, return a new array with only the system prompt.
async function loadHistory(key) {
    const filePath = `./history_${key}.json`;
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [systemPrompt];
    }
}

// Save the conversation history to a file keyed by user key.
async function saveHistory(key, history) {
    const filePath = `./history_${key}.json`;
    await fs.writeFile(filePath, JSON.stringify(history, null, 2));
}

async function main() {
    console.log("Welcome to the AI Chat Application!");
    console.log("1. Generate a new key");
    console.log("2. Enter an existing key");

    const option = await promptInput("Select an option (1 or 2): ");
    let userKey;

    if (option === "1") {
        // Generate a new key using random bytes (16 bytes -> 32 hex characters)
        userKey = randomBytes(16).toString('hex');
        console.log(`Your new key is: ${userKey}`);
    } else if (option === "2") {
        userKey = await promptInput("Enter your key: ");
        if (!userKey) {
            console.error("Invalid key. Exiting.");
            process.exit(1);
        }
    } else {
        console.error("Invalid option. Exiting.");
        process.exit(1);
    }

    // Load conversation history from disk (or start new if not found)
    let messages = await loadHistory(userKey);

    // Print loaded conversation (optional)
    console.log("\nLoaded conversation history:");
    messages.forEach((msg) => {
        console.log(`${msg.role}: ${msg.content}`);
    });
    console.log("\nChat session started. Type your message (or 'exit' to quit):");

    // Create a readline interface for chat interaction.
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'You: '
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const userInput = line.trim();
        if (userInput.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        // Append the user's message to the conversation
        messages.push({ role: "user", content: userInput });

        // Use only the last 30 messages (plus system prompt at index 0) for context
        let contextMessages;
        if (messages.length > 31) {
            contextMessages = [messages[0], ...messages.slice(-30)];
        } else {
            contextMessages = messages;
        }

        try {
            // Call the OpenAI Chat API
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: contextMessages
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const reply = data.choices[0].message.content.trim();
            console.log(`Assistant: ${reply}`);
            messages.push({ role: "assistant", content: reply });

            // Limit stored history to full conversation (you may choose to store it entirely if desired)
            // Here we save the full conversation history on disk, but send only the last 30 messages as context.
            await saveHistory(userKey, messages);
        } catch (error) {
            console.error("Error communicating with OpenAI:", error);
        }

        rl.prompt();
    }).on('close', () => {
        console.log("Chat session ended.");
        process.exit(0);
    });
}

main();
