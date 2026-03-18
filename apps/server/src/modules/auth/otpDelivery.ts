import sgMail from "@sendgrid/mail";
import { env } from "../../config/env";

type OtpChannel = "email" | "phone";
type OtpPurpose = "registration" | "resend" | "password_reset";

const appName = "Rideforge";

let sendgridReady = false;

if (env.sendgridApiKey) {
  sgMail.setApiKey(env.sendgridApiKey);
  sendgridReady = true;
}

export async function deliverOtp(input: {
  channel: OtpChannel;
  target: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const body = `${appName} verification code: ${input.code}. It expires in 10 minutes.`;
  const subject = `${appName} verification code`;

  if (env.otpProviderMode === "log") {
    console.log(`[otp.log] ${input.channel.toUpperCase()} -> ${input.target} | ${input.code}`);
    return;
  }

  if (input.channel === "email") {
    if (!sendgridReady || !env.sendgridFromEmail) {
      handleProviderMissing("email", "SendGrid");
      console.log(`[otp.log-fallback] EMAIL -> ${input.target} | ${input.code}`);
      return;
    }
    await sgMail.send({
      to: input.target,
      from: env.sendgridFromEmail,
      subject,
      text: body,
      html: `<p>${body}</p>`,
    });
    return;
  }

  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFromPhone) {
    handleProviderMissing("phone", "Twilio");
    console.log(`[otp.log-fallback] PHONE -> ${input.target} | ${input.code}`);
    return;
  }

  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: input.target,
      From: env.twilioFromPhone,
      Body: body,
    }),
  });

  if (!response.ok) {
    throw new Error(`Twilio OTP delivery failed: ${response.status} ${await response.text()}`);
  }
}

function handleProviderMissing(channel: OtpChannel, provider: string): void {
  const message = `${provider} not configured for ${channel} OTP`;
  if (env.otpRequireLiveProviders) {
    throw new Error(message);
  }
  console.warn(`[otp.warn] ${message}; using log fallback`);
}
