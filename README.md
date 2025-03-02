# PeerGPT

PeerGPT is a peer-to-peer (P2P) chat application with integrated AI assistance—built for the hackathon! It leverages the power of distributed Hypercores and Hyperswarm for real-time replication of chat history and uses the OpenAI GPT-3.5-turbo model as an AI chat assistant. Built on the Pear platform with Bare modules, PeerGPT runs as a terminal application and requires no centralized server.

![NoteGPT-Flowchart-1740919393212](https://github.com/user-attachments/assets/a683e39e-59ba-42ce-8f94-dcea7ea703b5)


---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack & Specifications](#tech-stack--specifications)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Overview

**PeerGPT** is a decentralized chat application designed for real-time communication with an AI assistant. It allows users to create or join chat rooms by sharing a unique room key. All chat history is stored in a distributed, append-only log using Hypercore, and is automatically replicated among peers via Hyperswarm. The application integrates the OpenAI Chat API to provide intelligent responses based on the conversation context.

---

## Features

- **Peer-to-Peer Chat:**  
  Create or join chat rooms without a central server.
  
- **Distributed Storage:**  
  Chat history is stored using Hypercore, ensuring data is replicated across all peers.
  
- **AI Chat Assistant:**  
  Integrated with OpenAI GPT-3.5-turbo to provide context-aware assistance.
  
- **Real-Time Replication:**  
  Uses Hyperswarm for peer discovery and data replication.
  
- **Terminal Interface:**  
  Built as a terminal app using Bare modules (bare-readline, bare-tty, bare-process).

---

## Tech Stack & Specifications

- **Runtime & Platform:**  
  [Pear](https://docs.pears.com/) Platform built on [Bare](https://github.com/holepunchto/bare) – a lightweight JavaScript runtime for desktop and mobile.
  
- **Networking:**  
  [Hyperswarm](https://www.npmjs.com/package/hyperswarm) for P2P networking and peer discovery.
  
- **Data Storage:**  
  [Hypercore](https://github.com/mafintosh/hypercore) as an append-only log for chat history.
  
- **Cryptography:**  
  [hypercore-crypto](https://www.npmjs.com/package/hypercore-crypto) for secure key generation.
  
- **Terminal I/O:**  
  [bare-readline](https://www.npmjs.com/package/bare-readline) and [bare-tty](https://www.npmjs.com/package/bare-tty) for interactive command-line interface.
  
- **HTTP Client:**  
  [bare-http1](https://www.npmjs.com/package/bare-http1) to make HTTPS requests to the OpenAI API.
  
- **In-Memory Storage for Debugging:**  
  [random-access-memory](https://www.npmjs.com/package/random-access-memory) for temporary storage during development (configurable).

---

## Architecture

PeerGPT consists of several key components:

- **Chat Room Key Management:**  
  Users are prompted to create or join a chat room via a unique room key. This key is used to namespace Hypercore storage and as the topic for peer discovery in Hyperswarm.

- **Distributed Chat Log (Hypercore):**  
  All messages (user and assistant) are stored in an append-only Hypercore log. The log is replicated among all peers that join the same chat room, ensuring that every participant sees the same history.

- **Peer Discovery (Hyperswarm):**  
  The application uses Hyperswarm to find and connect to peers that share the same room key. Upon connection, Hypercore replication is initiated.

- **AI Assistant Integration:**  
  When a user sends a message, the application builds context from recent messages and sends it to the OpenAI Chat API (using the bare-http1 module). The assistant’s reply is then appended to the Hypercore and broadcast to all peers.

- **Terminal Interface:**  
  A raw-mode terminal interface is implemented using bare-readline and bare-tty, enabling real-time chat interactions.

---

## Installation & Setup

### Prerequisites

- **Pear CLI & Bare Runtime:**  
  Install the Pear CLI globally using npm. (Pear is independent of Node.js and leverages Bare.)
  
  ```bash
  npm install -g pear
  ```

- **OpenAI API Key:**  
  Set your OpenAI API key as an environment variable:

  ```bash
  export OPENAI_API_KEY=your_openai_api_key_here
  ```

### Clone & Install Dependencies

Clone the repository and install required dependencies:

```bash
git clone https://github.com/yourusername/peergpt.git
cd peergpt
npm install bare-readline bare-tty bare-process hyperswarm b4a hypercore-crypto hypercore random-access-memory bare-http1
```

---

## Usage

### Running the Application

Launch PeerGPT with the Pear CLI:

```bash
pear run --dev .
```

### How It Works

1. **Room Selection:**  
   When the application starts, you'll be prompted to create a new chat room or join an existing one. Choosing option **1** creates a new room and displays a unique room key.

2. **Chat Interface:**  
   The terminal displays your chat history and a prompt (`You: `) for new messages.

3. **AI Integration:**  
   As you type a message, the application appends it to the distributed Hypercore, builds a context of recent messages, and sends them to the OpenAI Chat API. The AI's reply is then appended to the chat log and appears on your screen and on connected peers.

4. **Peer Replication:**  
   Peers that join using the same room key replicate the Hypercore log in real time, ensuring a synchronized chat experience.

### Debug Information

The application outputs detailed debug logs during initialization and when sending API requests. These logs help trace execution and diagnose issues.

---

## Tech Specs (Documentation)

### Hypercore Integration

- **Initialization:**  
  Hypercore is initialized with a storage function. In development, RAM storage is used by setting `USE_RAM_STORAGE` to `true`.

- **Data Storage:**  
  Messages are stored in JSON format in an append-only log.

### Peer Discovery (Hyperswarm)

- **Topic:**  
  The chat room key (hex-encoded) is used as the topic for joining the Hyperswarm.

- **Replication:**  
  On every new peer connection, Hypercore replication is piped between the local and remote peer.

### OpenAI API Communication

- **HTTP Client:**  
  Instead of the native fetch, the application uses the `bare-http1` module to perform HTTPS POST requests.

- **Request/Response Cycle:**  
  The application sends a JSON payload containing the conversation context to `https://api.openai.com/v1/chat/completions`. Response chunks and parsing are logged for debugging.

### Terminal Interface

- **Interactive CLI:**  
  Uses `bare-readline` and `bare-tty` to create a raw-mode input/output interface for interactive chat.

- **Custom Prompt:**  
  Since `bare-readline` does not support `setPrompt()`, the prompt is manually printed to stdout.

---

## Future Improvements

- **Persistent File Storage:**  
  Enable file-based storage for production use instead of in-memory (RAM) storage.

- **Enhanced UI:**  
  Develop a desktop GUI using Peer’s Desktop tools.

- **Robust Error Handling:**  
  Improve error reporting and reconnection logic for network failures.

- **Additional Features:**  
  Add support for group chats, file sharing, and further customization of AI responses.

---

## License

This project is licensed under the [Apache-2.0 License](LICENSE).

---

Feel free to contribute, report issues, or suggest features. Let's make PeerGPT a truly unstoppable P2P AI chat application!

---

*PeerGPT – Built for the Peer Hackathon by [Your Name/Team].*
