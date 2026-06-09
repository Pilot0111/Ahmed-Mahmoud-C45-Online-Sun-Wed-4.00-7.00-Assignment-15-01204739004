import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ObjectCannedACL,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  AWS_ACCESS_KEY_ID,
  AWS_BUCKET_NAME,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
} from "../../config/config.service";
import { randomUUID } from "node:crypto";
import { Store_Enum } from "../enum/multer.enum";
import fs from "node:fs";
import { AppError } from "../utils/global-error-handler";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  async uploadFile({
    store_type = Store_Enum.memory,
    file,
    path = "General",
    ACL,
  }: {
    store_type?: Store_Enum;
    ACL?: ObjectCannedACL | undefined;
    file: Express.Multer.File;
    path?: string;
  }): Promise<string> {
    // Changed return type to Promise<string>
    try {
      const key = `Social_Media_App/${path}/${randomUUID()}_${file.originalname}`;
      const command = new PutObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer ? file.buffer : fs.createReadStream(file.path),
        ContentType: file.mimetype,
        ...(ACL && { ACL }),
      });

      await this.client.send(command);
      return key;
    } catch (error) {
      console.error("S3 PutObject Error:", error); // Log the original error for debugging
      throw new AppError("Failed to upload file to S3", 500);
    }
  }
  async uploadLargeFile({
    store_type = Store_Enum.disk,
    file,
    path = "General",
    ACL,
  }: {
    store_type?: Store_Enum;
    ACL?: ObjectCannedACL | undefined;
    file: Express.Multer.File;
    path?: string;
  }): Promise<string> {
    // Changed return type to Promise<string>
    try {
      const key = `Social_Media_App/${path}/${randomUUID()}_${file.originalname}`;
      const command = new Upload({
        client: this.client,
        params: {
          Bucket: AWS_BUCKET_NAME,
          Key: key,
          // Use stream if file.path exists (disk storage),
          // fall back to buffer only if necessary (memory storage)
          Body: file.path ? fs.createReadStream(file.path) : file.buffer,
          ContentType: file.mimetype,
          ...(ACL && { ACL }),
        },
      });

      command.on("httpUploadProgress", (progress) => {
        console.log(`Upload progress: ${progress.loaded} / ${progress.total}`);
      });
      const result = await command.done();
      // result.Key can be undefined in the type definition, so fallback to our generated key
      return result.Key || key;
    } catch (error) {
      console.error("S3 UploadLargeFile Error:", error); // Log the original error for debugging
      throw new AppError("Failed to upload large file to S3", 500);
    }
  }
  async uploadFiles({
    store_type = Store_Enum.disk,
    files,
    path = "General",
    ACL,
    isLargeFile = false,
  }: {
    store_type?: Store_Enum;
    ACL?: ObjectCannedACL | undefined;
    files: Express.Multer.File[];
    path?: string;
    isLargeFile?: boolean;
  }): Promise<string[]> {
    // Changed return type to Promise<string[]>
    try {
      let urls: string[] = []; // Explicitly type as string[] for clarity
      if (isLargeFile) {
        urls = await Promise.all(
          files.map((file) =>
            this.uploadLargeFile({ store_type, file, path, ACL }),
          ),
        ); // Now returns string[]
      } else {
        urls = await Promise.all(
          files.map((file) => this.uploadFile({ store_type, file, path, ACL })),
        ); // Now returns string[]
      }
      return urls;
    } catch (error) {
      console.error("S3 UploadFiles Error:", error); // Log the original error for debugging
      throw new AppError("Failed to upload files to S3", 500);
    }
  }
  async creatPresignedUrl({
    fileName,
    path,
    contentType,
    expiresIn = 3600,
  }: {
    fileName: string;
    path: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<{ url: string; Key: string }> {
    try {
      const Key = `Social_Media_App/${path}/${randomUUID()}_${fileName}`;
      const command = new PutObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return {url, Key};
    } catch (error) {
      console.error("S3 CreatePresignedUrl Error:", error); // Log the original error for debugging
      throw new AppError("Failed to create presigned URL for S3", 500);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({ 
        Bucket: AWS_BUCKET_NAME,
        Key: key,
      });
      await this.client.send(command);
    } catch (error) {
      console.error("S3 DeleteObject Error:", error);
      throw new AppError("Failed to delete file from S3", 500);
    }
  }

  async getFile({
    key,
  }: {
    key: string;
  }) {
    try {
      const command = new GetObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
      });
      return await this.client.send(command);
    } catch (error: any) {
      console.error("S3 getFile Error:", error.name, error.message);
      if (error.name === "NoSuchKey") {
        throw new AppError("File not found in S3", 404);
      }
      throw new AppError("Failed to get file from S3", 500);
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: AWS_BUCKET_NAME,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      });
      await this.client.send(command);
    } catch (error) {
      console.error("S3 DeleteObjects Error:", error);
      throw new AppError("Failed to delete files from S3", 500);
    }
  }

  async listFiles({ path }: { path: string }) {
    try {
      // Ensure path doesn't have leading/trailing slashes before prefixing
      const normalizedPath = path.replace(/^\/+|\/+$/g, "");
      const prefix = `Social_Media_App/${normalizedPath}/`;

      const command = new ListObjectsV2Command({
        Bucket: AWS_BUCKET_NAME,
        Prefix: prefix,
      });

      const result = await this.client.send(command);
      return result.Contents || [];
    } catch (error) {
      console.error("S3 listFiles Error:", error);
      throw new AppError("Failed to list files from S3", 500);
    }
  }

  async getPresignedUrl({
    path,
    fileName,
    expiresIn = 3600,  }: {
    path: string;
    fileName: string;
    expiresIn?: number;
  }): Promise<{ url: string }> {
    try {
      const Key = `Social_Media_App/${path}/${randomUUID()}_${fileName}`;
      const command = new PutObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key,
      });
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return { url };
    } catch (error) {
      console.error("S3 getPresignedUrl Error:", error);
      throw new AppError("Failed to create presigned URL for S3", 500);
    }
  }
  async getPresignedUrlByKey({
    key,
    expiresIn = 3600,
    download = false,
  }: {
    key: string;
    expiresIn?: number;
    download?: boolean;
  }): Promise<string> {
    try {
      const filename = key.split("/").pop();
      const encodedFilename = encodeURIComponent(filename || "file");
      const disposition = download 
        ? `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}` 
        : "inline";

      const command = new GetObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: disposition,
      });
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error: any) {
      console.error("S3 getPresignedUrl Error:", error.name, error.message);
      if (error.name === "NoSuchKey") {
        throw new AppError("File not found in S3", 404);
      }
      throw new AppError("Failed to create presigned URL for S3", 500);
    }
  }
}
