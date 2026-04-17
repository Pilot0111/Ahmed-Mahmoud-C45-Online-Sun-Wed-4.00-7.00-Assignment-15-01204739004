import nodemailer from "nodemailer";
import { EMAIL, EMAIL_PASSWORD } from "../../../config/config.service";
import Mail from "nodemailer/lib/mailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL,
    pass: EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async (mailOptions: Mail.Options = {}) => {
  try {
    if (!mailOptions.to) throw new Error("Recipient email (to) is missing");

    const info = await transporter.sendMail({
      from: `"Saraha App" <${EMAIL}>`,
      ...mailOptions,
    });
    return info.accepted.length > 0;
  } catch (error: any) {
    console.error("Nodemailer transport error:", error.message);
    return false;
  }
};
