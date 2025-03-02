import { fileURLToPath } from "url";
import path from "path";
import readline from "readline";
import { getLlama, LlamaChatSession } from "node-llama-cpp";

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    // Initialize llama and load your model
    const llama = await getLlama();
    const model = await llama.loadModel({
        modelPath: path.join(__dirname, "models", "deepseek-r1-distill-llama-3b-q4_k_m.gguf")
    });
    const context = await model.createContext();
    const session = new LlamaChatSession({
        contextSequence: context.getSequence()
    });

    // Setup readline for interactive terminal chat
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "User: "
    });

    console.log("Interactive Chat Session started. Type 'exit' to quit.");
    rl.prompt();

    // Handle each line of user input
    rl.on("line", async (line) => {
        const input = line.trim();
        if (input.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        // Get response from the AI model
        try {
            const response = await session.prompt(input);
            console.log("====================================");
            console.log("AI: " + response);
            console.log("====================================");
        } catch (error) {
            console.error("Error during prompt:", error);
        }
        rl.prompt();
    });

    rl.on("close", () => {
        console.log("Chat session ended.");
        process.exit(0);
    });
}

main();
