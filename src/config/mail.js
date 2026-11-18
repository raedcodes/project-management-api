import nodemailer from "nodemailer";

const port = Number(process.env.MAIL_PORT) || 1025;

// Tests never touch the network: jsonTransport "sends" by returning the message as JSON
const options =
    process.env.NODE_ENV === "test"
        ? { jsonTransport: true }
        : {
            host: process.env.MAIL_HOST || "127.0.0.1",
            port,
            secure: port === 465, // true only for port 465; other ports upgrade to TLS if offered
            auth: process.env.MAIL_USER
                ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
                : undefined, // Mailpit needs no login; a real SMTP server does
        };

export const mailer = nodemailer.createTransport(options);
export const mailFrom = process.env.MAIL_FROM || "Task API <no-reply@example.com>";
