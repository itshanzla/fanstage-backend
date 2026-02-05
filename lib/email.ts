import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT
  ? Number(process.env.SMTP_PORT)
  : undefined;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || process.env.SMTP_USER;

if (!host || !port || !user || !pass || !from) {
  throw new Error("SMTP configuration is missing");
}

export const mailer = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

export const mailFrom = from;
