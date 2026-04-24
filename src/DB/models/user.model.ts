import mongoose, { Types } from "mongoose";
import { GenderEnum, RoleEnum } from "../../common/enum/user.enum";
import { providerEnum } from "../../common/enum/provider.enum";

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
  phone?: string | null;
  address?: string | null;
  provider?: providerEnum;
  profilePicture?: string | null;
  confirmed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true, min: 2, max: 25 },
    lastName: { type: String, required: true, trim: true, min: 2, max: 25 },
    email: { type: String, required: true, unique: true, trim: true },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === providerEnum.system;
      },
    },
    age: {
      type: Number,
      required: function (this: IUser) {
        return this.provider === providerEnum.system;
      },
      min: 18,
      max: 60,
    },
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
    provider: {
      type: String,
      enum: Object.values(providerEnum),
      default: providerEnum.system,
    },
    profilePicture: { type: String },
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

(userSchema.virtual("userName") as any)
  .get(function (this: IUser) {
    return `${this.firstName} ${this.lastName}`;
  })
  .set(function (this: any, value: string) {
    const [firstName = "", lastName = ""] = value.split(" ");
    this.firstName = firstName;
    this.lastName = lastName;
  });

userSchema.pre("save", function () {
  console.log("--- Document Middleware (pre-save) ---");
  console.log(`[${new Date().toISOString()}] Hook triggered for user ID: ${this._id || 'new document'}`);
  console.log(`[${new Date().toISOString()}] Data being persisted:`, this.toObject());
});

userSchema.pre("find", function () {
  console.log("--- Query Middleware (pre-find) ---");
  console.log(`[${new Date().toISOString()}] Hook triggered for model: ${this.model.modelName}`);
  console.log(`[${new Date().toISOString()}] Query Filter applied:`, this.getFilter());
});

export const userModel =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
export default userModel;
