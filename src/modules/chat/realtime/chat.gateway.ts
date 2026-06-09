import { Server, Socket } from "socket.io";
import chatEvent from "./chat.event.js";

class ChatGateway {
    constructor() { }

    registerEvent = async (socket: Socket, io: Server) => {
        chatEvent.sayHi(socket, io);
        chatEvent.privateMessage(socket, io);
        chatEvent.groupMessage(socket, io);
        chatEvent.broadcast(socket, io);
        chatEvent.joinRoom(socket, io);
    }
}

export default new ChatGateway()