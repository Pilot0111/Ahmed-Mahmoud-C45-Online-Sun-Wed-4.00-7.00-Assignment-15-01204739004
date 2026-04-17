import multer, { FileFilterCallback } from "multer";

import fs from "node:fs";
import { Request } from "express";

export const multer_local = ({customPath="General", customType = [] as string[]} = {}) => {
    const full_Path =`uploads/${customPath}`
    if (!fs.existsSync(full_Path)) {
      fs.mkdirSync(full_Path, { recursive: true });
    }


const storage = multer.diskStorage({ 
  destination: function (req: any, file: any, cb: (error: Error | null, destination: string) => void) {
    cb(null, full_Path);
  },
  filename: function (req: any, file: any, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "_" + file.originalname);
  },
});

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if (customType.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format"));
  }
};

const upload = multer({ storage, fileFilter });

return upload;
}

export const multerErrorHandler = (multerMiddleware: any) => {
  return (req: Request, res: any, next: any) => {
    multerMiddleware(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new Error(
              `Upload failed: Too many files for field '${err.field}' or incorrect field name.`,
              { cause: 400 }
            )
          );
        }
        return next(new Error(err.message, { cause: 400 }));
      }
      next();
    });
  };
};

export const multer_memory = () => {

const storage = multer.memoryStorage();

const upload = multer({ storage });

return upload;
}

export const multer_Cloudinary = ({customType=[]}={}) => {
  const storage = multer.diskStorage({});

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if ((customType as string[]).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format"));
  }
};

const upload = multer({ storage, fileFilter });

return upload;
}