import { Model } from "mongoose";
import BaseRepository from "./base.repository";
import storyModel, { IStory } from "../models/story.model";

class StoryRepository extends BaseRepository<IStory> {
  constructor(model: Model<IStory> = storyModel) {
    super(model);
  }
}

export default new StoryRepository();