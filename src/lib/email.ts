import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@yourapp.com",
    to: email,
    subject: "Reset Your Password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: var(--accent, #3b82f6); 
              color: white; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <div class="footer">
              <p>If you didn't request this, please ignore this email.</p>
              <p>For security reasons, this password reset link will only work once.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Reset Your Password
      
      You requested to reset your password. Click the link below to create a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this, please ignore this email.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send reset email");
  }
}

export async function sendInviteEmail(email: string, inviteToken: string) {
  const inviteTokenUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${inviteToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@yourapp.com",
    to: email,
    subject: "You're invited to join our platform - L9V AI Tools",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: var(--accent, #3b82f6); 
              color: white; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Accept invitation to join our platform</h2>
            <p>You have been invited to join L9V AI Business Tools. Click the button below to accept the invitation:</p>
            <a href="${inviteTokenUrl}" class="button">Accept Invitation</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${inviteTokenUrl}</p>
            <p><strong>This link will expire in 48 hours.</strong></p>
            <div class="footer">
              <p>If you didn't request this, please ignore this email.</p>
              <p>For security reasons, this invitation link will only work once.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Accept invitation to join our platform
      
      You have been invited to join our platform. Click the link below to accept the invitation:
      
      ${inviteTokenUrl}
      
      This link will expire in 48 hours.
      
      If you didn't request this, please ignore this email.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send invite email");
  }
}
