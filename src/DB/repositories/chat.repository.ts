import { Model } from "mongoose";
import BaseRepository from "./base.repository.js";
import chatModel, { IChat } from "../models/chat.model.js";

class ChatRepository extends BaseRepository<IChat> {
  constructor(model: Model<IChat> = chatModel) {
    super(model);
  }
}

export default new ChatRepository();