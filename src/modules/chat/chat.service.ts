import { Response, NextFunction } from "express";
import { Socket, Server } from "socket.io";
import userRepository from "../../DB/repositories/user.repository.js";
import chatRepository from "../../DB/repositories/chat.repository.js";
import { SuccessResponse } from "../../common/utils/response.success.js";
import { AppError } from "../../common/utils/global-error-handler.js";
import { S3Service } from "../../common/service/s3.service.js";
import { Store_Enum } from "../../common/enum/multer.enum.js";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";

class ChatService {
  private readonly _userRepo = userRepository;
  private readonly _chatRepo = chatRepository;
  private readonly _s3Service = new S3Service();

  constructor() {}

  // rest apis
  getChat = async (req: any, res: Response, next: any) => {
    try {
      const { userId } = req.params;
      const me = req.user._id;
      const { limit, page } = req.query;

      const result = await this._chatRepo.paginateMessages({
        page: Number(page),
        limit: Number(limit),
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
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getGroupChat = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const { limit, page } = req.query;

      const result = await this._chatRepo.paginateMessages({
        page: Number(page),
        limit: Number(limit),
        filter: {
          _id: groupId,
          group: { $exists: true },
          participants: req.user._id, // Ensure requester is a member
        },
        populate: [
          { path: "participants", select: "profilePicture firstName lastName userName" },
          { path: "messages.createdBy", select: "profilePicture firstName lastName userName" },
        ],
      });

      if (!result.data) {
        return next(new AppError("Group not found or access denied", 404));
      }

      SuccessResponse({
        res,
        message: "Group history retrieved",
        data: result,
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

  joinRoom = async (data: any, socket: Socket, io: Server) => {
    console.log({ data });
    const { roomId } = data;

    const chat = await this._chatRepo.findOne({
      filter: {
        roomId,
        participants: { $in: [socket.data.user._id] },
        group: { $exists: true },
      },
    });

    if (!chat) {
      throw new AppError("chat not found", 404);
    }

    socket.join(roomId);
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

    // Persistence logic for groups
    await this._chatRepo.findOneAndUpdate({
      filter: { _id: groupId, group: { $exists: true } },
      update: {
        $push: { messages: { content, createdBy: from._id } }
      }
    });

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

  createGroupChat = async (req: any, res: Response, next: NextFunction) => {
    try {
      const { group, participants } = req.body;
      const createdBy = req.user._id;

      // Convert string IDs to ObjectIds
      const participantList = Array.isArray(participants) ? participants : [participants];
      const dbParticipants = participantList.map((p: string) => new Types.ObjectId(p));

      // Validate: users must exist and be friends with the creator
      const users = await this._userRepo.find({
        filter: {
          _id: { $in: dbParticipants },
          friends: { $in: [createdBy] },
        },
      });

      if (users.length !== participantList.length) {
        return next(new AppError("Some users not found or are not in your friends list", 404));
      }

      // Add creator to participants
      dbParticipants.push(createdBy);

      const roomId = group?.replaceAll(/\s+/g, "-");
      let groupImage: string | undefined;

      if (req.file) {
        groupImage = await this._s3Service.uploadFile({
          file: req.file,
          path: `chat/${roomId}/${randomUUID()}`,
          store_type: Store_Enum.disk,
        });
      }

      const chat = await this._chatRepo.create({
        group,
        groupImage,
        participants: dbParticipants,
        createdBy,
        roomId,
        messages: [],
      } as any);

      if (!chat) {
        if (groupImage) await this._s3Service.deleteFile(groupImage);
        return next(new AppError("Failed to create group chat", 500));
      }

      SuccessResponse({
        res,
        status: 201,
        message: "Group chat created successfully",
        data: chat,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new ChatService();
