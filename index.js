#!/usr/bin/env node
import readline from 'bare-readline';
import tty from 'bare-tty';
import process from 'bare-process';
import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import Hypercore from 'hypercore';
import RAM from 'random-access-memory';
import http from 'bare-http1';

// Debug flag: if true, use RAM storage for Hypercore
const USE_RAM_STORAGE = true;

console.log("[DEBUG] Starting Peer AI Chat Application...");

// Check for the OpenAI API key in environment variables
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    console.error("Error: Please set the OPENAI_API_KEY environment variable.");
    process.exit(1);
}
console.log("[DEBUG] OpenAI API key found.");

// Define the system prompt that always starts the conversation
const systemPrompt = { role: "system", content: "You are a helpful assistant." };

/**
 * A simple prompt function that writes the query to stdout and
 * waits for one line of input from stdin.
 */
function promptInput(query) {
    console.log("[DEBUG] promptInput called with query:", query);
    process.stdout.write(query);
    return new Promise((resolve) => {
        process.stdin.once('data', (data) => {
            const input = data.toString().trim();
            console.log("[DEBUG] Received input:", input);
            resolve(input);
        });
    });
}

/**
 * Prompt the user to create or join a chat room.
 * Returns the chat room key.
 */
async function loadChatRoomKey() {
    console.log("[DEBUG] loadChatRoomKey() starting");
    console.log("Welcome to the Peer AI Chat Application!");
    console.log("1. Create a new chat room");
    console.log("2. Join an existing chat room");
    const option = await promptInput("Select an option (1 or 2): ");
    console.log("[DEBUG] Option selected:", option);
    let chatKey;
    if (option === "1") {
        // Generate a new key (16 bytes -> 32 hex characters)
        chatKey = crypto.randomBytes(16).toString('hex');
        console.log(`New chat room created. Your room key is: ${chatKey}`);
    } else if (option === "2") {
        chatKey = await promptInput("Enter your chat room key: ");
        if (!chatKey) {
            console.error("Invalid key. Exiting.");
            process.exit(1);
        }
        console.log("[DEBUG] Chat room key entered:", chatKey);
    } else {
        console.error("Invalid option. Exiting.");
        process.exit(1);
    }
    return chatKey;
}

async function main() {
    console.log("[DEBUG] main() starting");

    // Ensure stdin is in flowing mode.
    process.stdin.resume();
    console.log("[DEBUG] process.stdin resumed");

    // Get chat room key from the user.
    const chatRoomKey = await loadChatRoomKey();
    console.log("[DEBUG] chatRoomKey obtained:", chatRoomKey);

    // Set up storage for Hypercore.
    let storageFn, storageDesc;
    if (USE_RAM_STORAGE) {
        storageDesc = "RAM storage (random-access-memory)";
        storageFn = () => new RAM();
    } else {
        storageDesc = `./history_${chatRoomKey}`;
        storageFn = (filename) => filename; // default file storage
    }
    console.log(`[DEBUG] Initializing Hypercore with storage: ${storageDesc}`);

    // Initialize a Hypercore for chat history.
    const historyCore = new Hypercore(storageFn, { valueEncoding: 'json' });
    historyCore.on('error', (err) => console.error("[DEBUG] historyCore error:", err));
    console.log("[DEBUG] Awaiting historyCore.ready()...");
    await historyCore.ready();
    console.log("[DEBUG] historyCore ready. Current length:", historyCore.length);

    // If no history exists yet, append the system prompt.
    if (historyCore.length === 0) {
        console.log("[DEBUG] Hypercore is empty. Appending system prompt.");
        await historyCore.append(systemPrompt);
    }

    // Print existing chat history.
    console.log("\nChat History:");
    const historyStream = historyCore.createReadStream({ live: false });
    for await (const msg of historyStream) {
        console.log(`[${msg.role}] ${msg.content}`);
    }

    // Set up Hyperswarm for peer discovery using the chat room key.
    console.log("[DEBUG] Initializing Hyperswarm with topic:", chatRoomKey);
    const swarm = new Hyperswarm();
    const topicBuffer = b4a.from(chatRoomKey, 'hex');
    swarm.join(topicBuffer, { client: true, server: true });
    console.log("[DEBUG] Joined swarm. Waiting for swarm.flush()...");
    await swarm.flush();
    console.log("[DEBUG] Swarm flush complete.");

    // Replicate the Hypercore with each connecting peer.
    swarm.on('connection', (peer, info) => {
        const peerId = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 6);
        console.log(`[DEBUG] Peer connected: ${peerId}`);
        const repStream = historyCore.replicate(info.client);
        peer.pipe(repStream).pipe(peer);
    });

    // Open a live read stream (tail) that prints new messages as they are appended.
    const liveStream = historyCore.createReadStream({ live: true, tail: true });
    liveStream.on('data', (msg) => {
        console.log(`[LIVE] [${msg.role}] ${msg.content}`);
    });
    console.log("[DEBUG] Live stream set up.");

    // Set up the interactive readline interface.
    console.log("[DEBUG] Setting up readline interface.");
    const rl = readline.createInterface({
        input: new tty.ReadStream(0),
        output: new tty.WriteStream(1)
    });
    // Manually write the prompt, as bare-readline does not support setPrompt.
    process.stdout.write("You: ");
    rl.input.setMode(tty.constants.MODE_RAW);
    console.log("[DEBUG] Readline interface ready.");

    rl.on('data', async (line) => {
        const input = line.toString().trim();
        console.log("[DEBUG] Readline received input:", input);
        if (input.toLowerCase() === 'exit') {
            console.log("[DEBUG] Exit command received. Closing readline.");
            rl.close();
            return;
        }
        console.log("[DEBUG] Appending user message:", input);
        await historyCore.append({ role: 'user', content: input });

        // Build context from the last 30 messages.
        const total = historyCore.length;
        const start = Math.max(0, total - 30);
        console.log(`[DEBUG] Building context from messages ${start} to ${total}`);
        let context = [];
        for (let i = start; i < total; i++) {
            const msg = await historyCore.get(i);
            context.push(msg);
        }
        console.log("[DEBUG] Context built. Context length:", context.length);

        // Call the OpenAI Chat API using bare-http1.
        try {
            console.log("[DEBUG] Calling OpenAI API with context using bare-http1...");
            const options = {
                method: "POST",
                protocol: "https:",
                hostname: "api.openai.com",
                port: 443,
                path: "/v1/chat/completions",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                }
            };
            const requestBody = JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: context
            });
            const reply = await new Promise((resolve, reject) => {
                const req = http.request(options, (res) => {
                    let data = "";
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            return reject(new Error(`HTTP error! status: ${res.statusCode}`));
                        }
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed.choices[0].message.content.trim());
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                req.on('error', (err) => { reject(err); });
                req.write(requestBody);
                req.end();
            });
            console.log("[DEBUG] Received reply from OpenAI:", reply);
            await historyCore.append({ role: 'assistant', content: reply });
        } catch (error) {
            console.error("Error communicating with OpenAI:", error);
        }
        // Write prompt again.
        process.stdout.write("You: ");
    });

    rl.on('close', () => {
        console.log("[DEBUG] Readline closed. Exiting chat session.");
        process.exit(0);
    });

    console.log("[DEBUG] main() completed setup. Awaiting user input...");
}

main();
