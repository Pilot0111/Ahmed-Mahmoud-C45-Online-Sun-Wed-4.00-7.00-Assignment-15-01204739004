
import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "node:http";
import redisService from "../../common/service/redis.service";
import { socketIOauth } from "../../common/middleware/authentication";
import chatGateway from "../chat/realtime/chat.gateway";

class SocketGateway {
    constructor() { }

  initIo = async (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
    });

    io.use(socketIOauth);

    io.on("connection", async (socket: Socket) => {
        const userId = socket.data.user?._id;
        const userName = socket.data.user?.userName || "Anonymous";

        console.log(`[BACKEND] 🔌 New Connection: ${userName} (SocketID: ${socket.id})`);

        // 1. Lifecycle: Add to Redis
        await redisService.addSocket({ userId, SocketId: socket.id })
        
        // Join a personal room for private messaging
        socket.join(userId.toString());

        // 2. Diversion: Hand over to feature gateways
        await chatGateway.registerEvent(socket, io);

        console.log(`[BACKEND] 📈 Total Active Connections: ${io.engine.clientsCount}`);
        console.log({ userSocketIds: await redisService.getSockets(userId) });
        
        socket.on("disconnect", async () => {
            console.log(`[BACKEND] ❌ Client disconnected: ${userName} (ID: ${socket.id})`);
            await redisService.removeSocket({ userId, SocketId: socket.id })
            console.log(`[BACKEND]  Total Active Connections: ${io.engine.clientsCount}`);
            console.log({ userSocketIdsAfterDisconnect: await redisService.getSockets(userId) });
        })
    })

    // --- MULTIPLEXING: Admin Namespace ---
    const adminNamespace = io.of("/admin");
    adminNamespace.use(socketIOauth);

    adminNamespace.on("connection", (socket: Socket) => {
      console.log(`[BACKEND] 🛡️ Admin Namespace: Admin connected. ID: ${socket.id}`);
      socket.on("adminCommand", (data: any) => {
        console.log(`[BACKEND] 📥 Admin Command Received:`, data);
        socket.emit("adminResponse", { status: "Success", details: "Admin action logged." });
      });
    });
  };
}

export default new SocketGateway()