import { hashSync, compareSync } from "bcrypt";
import { SALT_ROUNDS } from "../../../config/config.service";

export const hashPassword = ({
  plainText,
  salt_rounds = SALT_ROUNDS,
}: {
  plainText: string;
  salt_rounds?: number;
}): string=> hashSync(plainText.toString(), salt_rounds);

export const comparePassword = ({
  PlainText,
  cipherText,
}: {
  PlainText: string;
  cipherText: string;
}): boolean => compareSync(PlainText, cipherText);
