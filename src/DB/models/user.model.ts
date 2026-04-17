import mongoose, { Types } from "mongoose";
import { GenderEnum, RoleEnum } from "../../common/enum/user.enum";

export interface IUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  age: number;
  gender?: GenderEnum;
  role?: RoleEnum;
  phone?: string;
  address?: string;
  confirmed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true, min: 2, max: 25 },
    lastName: { type: String, required: true, trim: true, min: 2, max: 25 },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, min: 6, max: 100 },
    age: { type: Number, required: true, min: 18, max: 60 },
    gender: {
      type: String,
      enum: Object.values(GenderEnum),
      default: GenderEnum.male,
    },
    role: {
      type: String,
      enum: Object.values(RoleEnum),
      default: RoleEnum.user,
    },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    confirmed: { type: Boolean },
  },
  {
    timestamps: true,
    // strict: true, // Enforce strict mode to prevent saving fields not defined in the schema,
    strictQuery: true, // Enforce strict query mode to prevent querying with fields not defined in the schema
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);

userSchema.virtual("userName").get(function () {
  return `${this.firstName} ${this.lastName}`;
}).set(function (value: string) {
  const [firstName, lastName] = value.split(" ");
  this.set({ firstName, lastName });
});

export const userModel = mongoose.models.User  || mongoose.model<IUser>("User", userSchema);
export default userModel;
