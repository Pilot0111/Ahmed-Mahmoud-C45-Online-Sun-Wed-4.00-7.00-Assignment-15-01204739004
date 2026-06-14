import { Server, Socket } from "socket.io";
import chatService from "../chat.service.js";

class ChatEvent {
    constructor() { }

    /**
     * Registers the 'sayHi' event
     */
    sayHi = (socket: Socket, io: Server) => {
        socket.on("sayHi", (data, callback) => {
            console.log(`[BACKEND] 📥 Received 'sayHi' from ${socket.data.user?.userName}:`, data);
            chatService.sayHi(data);
            if (callback) callback({ status: "ok", message: "Hi from Backend" });
        });
    };

    /**
     * Registers the 'broadcastExample' event
     */
    broadcast = (socket: Socket, io: Server) => {
        socket.on("broadcastExample", (data) => {
            console.log(`[BACKEND] 📣 Broadcasting message from ${socket.id}:`, data);
            chatService.logEvent("Broadcast", data);
            socket.broadcast.emit("globalAnnouncement", { sender: socket.id, message: data });
        });
    };

    /**
     * Registers the 'joinRoom' event
     */
    joinRoom = (socket: Socket, io: Server) => {
        socket.on("joinRoom", async (data) => {
            try {
                await chatService.joinRoom(data, socket, io);
                const roomId = typeof data === "string" ? data : data.roomId;
                socket.to(roomId).emit("roomUpdate", `User ${socket.data.user.userName} has entered the room.`);
            } catch (error: any) {
                socket.emit("custom_error", { message: error.message || "Failed to join room" });
            }
        });
    };

    /**
     * Registers the 'privateMessage' event
     */
    privateMessage = (socket: Socket, io: Server) => {
        socket.on("privateMessage", (data) => {
            console.log(`[BACKEND] 📨 Private message event triggered by ${socket.id}`);
            chatService.sendMessage(socket, data, io);
        });
    };

    /**
     * Registers the 'sendGroupMessage' event
     */
    groupMessage = (socket: Socket, io: Server) => {
        socket.on("sendGroupMessage", (data) => {
            console.log(`[BACKEND] 👥 Group message event triggered by ${socket.id}`);
            chatService.sendGroupMessage(socket, data, io);
        });
    };
}

export default new ChatEvent()