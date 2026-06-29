// No real email transport is wired: sendMail() logs the link to the server console. To enable real
// delivery: `npm i resend`, set RESEND_API_KEY + APP_BASE_URL, and send from the stub branch below.

const APP_BASE_URL_FALLBACK: string = "http://localhost:3001";

export function buildAppUrl(path: string): string
{
    const configuredBase: string = process.env.APP_BASE_URL ?? APP_BASE_URL_FALLBACK;
    const normalizedBase: string = configuredBase.endsWith("/") === true ? configuredBase.slice(0, -1) : configuredBase;
    const normalizedPath: string = path.startsWith("/") === true ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
}

export async function sendMail(recipientEmail: string, subject: string, body: string): Promise<void>
{
    console.error("📧:", `To: ${recipientEmail} | Subject: ${subject}\n${body}`);
}
