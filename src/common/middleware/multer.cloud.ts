import { Request } from "express";
import multer, { FileFilterCallback } from "multer";
import { File_Type_Enum, Store_Enum } from "../enum/multer.enum";
import { tmpdir } from "node:os";
import { AppError } from "../utils/global-error-handler";

const multerCloud = ({
  store_type = Store_Enum.memory,
  custom_types = File_Type_Enum.image,
  MaxFileSize = 1024 * 1024* 5, // 5MB
}: {
  store_type?: Store_Enum; 
  custom_types?: File_Type_Enum;
  MaxFileSize?: number;
} = {}) => {
  const storage =
    store_type === Store_Enum.memory
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: tmpdir(),
          filename: function (
            req: Request,
            file: Express.Multer.File,
            cb: Function,
          ) {
            const uniqueSuffix =
              Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, uniqueSuffix + "_" + file.originalname);
          },
        });

  const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (file.mimetype.startsWith(custom_types)) {
      cb(null, true);
    } else {
      cb(new AppError("Invalid file type", 400) as any, false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: MaxFileSize,
    },
  });
  return upload;
};

export default multerCloud;
