import path from "bare-path";
import readline from "bare-readline";  // для терминального ввода в Bare
import tty from "bare-tty";            // для работы с терминалом
import process from "bare-process";    // управление процессом в Bare
import { getLlama, LlamaChatSession } from "node-llama-cpp";

// Получаем __dirname: используем new URL() вместо fileURLToPath из "url"
const __dirname = new URL('.', import.meta.url).pathname;

async function main() {
    // Инициализируем Llama и загружаем модель
    const llama = await getLlama();
    const model = await llama.loadModel({
        modelPath: path.join(__dirname, "models", "deepseek-r1-distill-llama-3b-q4_k_m.gguf")
    });
    const context = await model.createContext();
    const session = new LlamaChatSession({
        contextSequence: context.getSequence()
    });

    // Настраиваем bare-readline для интерактивного чата в терминале
    const rl = readline.createInterface({
        input: new tty.ReadStream(0),
        output: new tty.WriteStream(1)
    });
    rl.setPrompt("User: ");

    console.log("Interactive Chat Session started. Type 'exit' to quit.");
    rl.prompt();

    rl.on("line", async (line) => {
        const input = line.trim();
        if (input.toLowerCase() === "exit") {
            rl.close();
            return;
        }
        try {
            // Получаем ответ от модели
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
