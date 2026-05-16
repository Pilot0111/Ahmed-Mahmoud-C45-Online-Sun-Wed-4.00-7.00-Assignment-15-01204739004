import { Availability_Enum } from "../enum/post.enum";
import { Request } from "express";

export const availabilityPost = (req: Request) => {
  return {
    $or: [
      { availability: Availability_Enum.public },
      { availability: Availability_Enum.only_me, createdBy: req.user._id },
      {
        availability: Availability_Enum.friends,
        createdBy: { $in: [...(req.user?.friends || []), req.user._id] },
      },
      { mentions: { $in: [req.user._id] } },
    ],
  };
};
