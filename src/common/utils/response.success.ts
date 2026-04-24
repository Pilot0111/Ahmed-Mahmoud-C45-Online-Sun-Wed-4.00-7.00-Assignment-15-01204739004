import { Response } from "express";

export const SuccessResponse = ({
  res,
  status = 200,
  message = "success",
  data=undefined,
}: {
  res: Response;
  status?: number;
  message?: string;
  data?: any| undefined;
}) => {
  return res.status(status).json({ message, data });
};
