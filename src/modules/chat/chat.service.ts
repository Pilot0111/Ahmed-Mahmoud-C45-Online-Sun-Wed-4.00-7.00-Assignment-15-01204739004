import { Response } from "express";
import { Socket, Server } from "socket.io";
import userRepository from "../../DB/repositories/user.repository.js";
import chatRepository from "../../DB/repositories/chat.repository.js";
import { SuccessResponse } from "../../common/utils/response.success.js";

class ChatService {
  private readonly _userRepo = userRepository;
  private readonly _chatRepo = chatRepository;

  constructor() {}

  // rest apis
  getChat = async (req: any, res: Response, next: any) => {
    try {
      const { userId } = req.params;
      const me = req.user._id;

      const chat = await this._chatRepo.findOne({
        filter: {
          participants: { $all: [me, userId] },
          group: { $exists: false },
        },
        populate: [
          {
            path: "participants",
            select: "profilePicture firstName lastName",
          },
          {
            path: "messages.createdBy",
            select: "profilePicture firstName lastName",
          },
        ],
      });

      SuccessResponse({
        res,
        message: "Chat history retrieved",
        data: { chat: chat || null },
      });
    } catch (error) {
      next(error);
    }
  };
  // socket.io
  sayHi = async (data: any) => {
    console.log(data);
  };

  logEvent = async (type: string, data: any) => {
    console.log(`[CHAT SERVICE] 📝 Logged ${type}:`, data);
  };

  sendMessage = async (socket: Socket, data: any, io: Server) => {
    const { targetId, message } = data;
    const from = socket.data.user._id;

    // Find the chat and push the message, or create the chat if it doesn't exist (upsert)
    await this._chatRepo.findOneAndUpdate({
        filter: {
            participants: { $all: [from, targetId] },
            group: { $exists: false }
        },
        update: {
            $push: { messages: { content: message, createdBy: from } },
            $setOnInsert: { createdBy: from, participants: [from, targetId] }
        },
        options: { upsert: true }
    });

    // Notify the sender on ALL their open tabs/devices
    io.to(from.toString()).emit("successMessage", { content: message, targetId });
    
    // Send to the recipient on ALL their open tabs/devices
    io.to(targetId).emit("directMessage", { 
      from: {
        _id: socket.data.user._id,
        profilePicture: socket.data.user.profilePicture,
        userName: socket.data.user.userName
      }, 
      message 
    });
  };

  sendGroupMessage = async (socket: Socket, data: any, io: Server) => {
    const { groupId, content } = data;
    const from = socket.data.user;

    // TODO: Persistence logic for groups (chatRepository.create/update)

    // Notify the sender
    socket.emit("successMessage", { content });

    // Broadcast to the group room
    io.to(groupId).emit("directMessage", {
      message: content,
      groupId: groupId,
      from: {
        _id: from._id,
        profilePicture: from.profilePicture,
        userName: from.userName
      }
    });
  };
}

export default new ChatService();
