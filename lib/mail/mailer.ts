import nodemailer from "nodemailer";

// Real delivery turns on when the SMTP_* env vars are set; until then sendMail() just logs the message
// (link included) to the server console. Required env: SMTP_HOST, SMTP_USER, SMTP_PASS. Optional:
// SMTP_PORT (default 465), MAIL_FROM (default SMTP_USER), APP_BASE_URL (the public origin for email links).

const APP_BASE_URL_FALLBACK: string = "http://localhost:3001";
const DEFAULT_SMTP_PORT: number = 465;

function buildTransporter(): nodemailer.Transporter | null
{
    const smtpHost: string | undefined = process.env.SMTP_HOST;
    const smtpUser: string | undefined = process.env.SMTP_USER;
    const smtpPassword: string | undefined = process.env.SMTP_PASS;

    if (smtpHost === undefined || smtpUser === undefined || smtpPassword === undefined)
    {
        return null;
    }

    const smtpPort: number = Number.parseInt(process.env.SMTP_PORT ?? String(DEFAULT_SMTP_PORT), 10);

    return nodemailer.createTransport(
    {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPassword },
    });
}

const transporter: nodemailer.Transporter | null = buildTransporter();
const mailFromAddress: string = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "noreply@localhost";

export function buildAppUrl(path: string): string
{
    const configuredBase: string = process.env.APP_BASE_URL ?? APP_BASE_URL_FALLBACK;
    const normalizedBase: string = configuredBase.endsWith("/") === true ? configuredBase.slice(0, -1) : configuredBase;
    const normalizedPath: string = path.startsWith("/") === true ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
}

export async function sendMail(recipientEmail: string, subject: string, body: string): Promise<void>
{
    if (transporter === null)
    {
        console.error("📧:", `To: ${recipientEmail} | Subject: ${subject}\n${body}`);
        return;
    }

    await transporter.sendMail(
    {
        from: mailFromAddress,
        to: recipientEmail,
        subject: subject,
        text: body,
    });
}

export async function trySendMail(recipientEmail: string, subject: string, body: string): Promise<void>
{
    try
    {
        await sendMail(recipientEmail, subject, body);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}
