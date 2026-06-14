import { Model, PopulateOptions, QueryFilter } from "mongoose";
import BaseRepository from "./base.repository.js";
import chatModel, { IChat } from "../models/chat.model.js";

class ChatRepository extends BaseRepository<IChat> {
  constructor(model: Model<IChat> = chatModel) {
    super(model);
  }

  async paginateMessages({
    filter,
    page,
    limit,
    populate = [],
  }: {
    filter: QueryFilter<IChat>;
    page: number;
    limit: number;
    populate?: PopulateOptions | PopulateOptions[];
  }) {
    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.max(Number(limit) || 5, 1);

    // 1. Get total message count for metadata calculation
    const chatInfo = await this.model.findOne(filter, { messages: 1 });
    const totalMessages = chatInfo?.messages?.length || 0;

    // 2. Fetch the chat document with the specific slice of messages
    const chat = await this.findOne({
      filter,
      projection: { messages: { $slice: [-(normalizedPage * normalizedLimit), normalizedLimit] } },
      populate,
    });

    return {
      meta: {
        Current_Page: normalizedPage,
        Total_Pages: Math.ceil(totalMessages / normalizedLimit),
        limit: normalizedLimit,
        Total_Messages: totalMessages,
      },
      data: chat,
    };
  }
}

export default new ChatRepository();