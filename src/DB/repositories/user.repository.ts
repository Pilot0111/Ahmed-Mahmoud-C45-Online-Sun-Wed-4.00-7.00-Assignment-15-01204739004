import {
  HydratedDocument,
  Model,
  PopulateOptions,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  Types,
  UpdateQuery,
} from "mongoose";
import { AppError } from "../../common/utils/global-error-handler";
import BaseRepository from "./base.repository";
import userModel, { IUser } from "../models/user.model";

class userRepository extends BaseRepository<IUser> {
  constructor(model: Model<IUser> = userModel) {
    super(model);
  }
  async checkUser(email: string): Promise<boolean> {
    const emailExists = await this.findOne({ filter: { email } });
    if (emailExists) {
      throw new AppError("Email already exists", 409);
    }
    return true;
  }
}

export default new userRepository();
