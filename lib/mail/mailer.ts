import nodemailer from "nodemailer";

// Real delivery turns on when the SMTP_* env vars are set and MAIL_DISABLED is not "true"; otherwise
// sendMail() logs the message to the console. Required: SMTP_HOST/USER/PASS. Optional: SMTP_PORT (465),
// MAIL_FROM, APP_BASE_URL, MAIL_DISABLED=true (e2e forces log-only so tests never consume mail quota).

const APP_BASE_URL_FALLBACK: string = "http://localhost:3001";
const DEFAULT_SMTP_PORT: number = 465;
const E2E_DATABASE_MARKER: string = "protonet-e2e-test";

function isRealMailDisabled(): boolean
{
    if (process.env.MAIL_DISABLED === "true")
    {
        return true;
    }

    const databasePath: string | undefined = process.env.DATABASE_PATH;
    return databasePath !== undefined && databasePath.includes(E2E_DATABASE_MARKER);
}

function buildTransporter(): nodemailer.Transporter | null
{
    if (isRealMailDisabled() === true)
    {
        return null;
    }

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
