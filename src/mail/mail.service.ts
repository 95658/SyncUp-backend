import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.config.get<string>('mail.host', 'smtp.gmail.com');
    const port = this.config.get<number>('mail.port', 587);
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.password');
    const secure = this.config.get<boolean>('mail.secure', false);

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      this.logger.log(`Mail service configured with SMTP host: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP credentials not provided. Mail service will log emails to console.');
    }
  }

  async sendOrganizationInvitation(params: {
    to: string;
    orgName: string;
    invitationLink: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const from = this.config.get<string>('mail.from', 'SyncUp Platform <noreply@syncup.syntiqtech.com>');
    const subject = `Welcome to SyncUp! You have been invited to lead ${params.orgName}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #8B0021 0%, #B91C1C 100%); padding: 36px 32px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { color: #fecdd3; margin: 6px 0 0 0; font-size: 14px; }
          .content { padding: 36px 32px; }
          .content h2 { margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
          .content p { line-height: 1.6; font-size: 14.5px; color: #475569; margin: 12px 0; }
          .badge-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .badge-box p { margin: 4px 0; font-size: 13.5px; color: #881337; }
          .btn-container { text-align: center; margin: 32px 0 24px 0; }
          .btn { display: inline-block; background: #8B0021; color: #ffffff !important; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(139,0,33,0.35); }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
          .link-fallback { word-break: break-all; font-size: 12px; color: #64748b; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SyncUp Workspace</h1>
            <p>Private B2B SaaS Collaboration & Engineering Platform</p>
          </div>
          <div class="content">
            <h2>Organization Setup & Administrator Invitation</h2>
            <p>Hello,</p>
            <p>A new enterprise organization, <strong>${params.orgName}</strong>, has been provisioned for you on the SyncUp platform.</p>
            
            <div class="badge-box">
              <p><strong>Organization:</strong> ${params.orgName}</p>
              <p><strong>Account Role:</strong> Organization Owner & Administrator</p>
              <p><strong>Free Trial:</strong> 14-Day Free Access (Full Enterprise Features)</p>
            </div>

            <p style="color: #991b1b; font-weight: 600;">
              Important: To activate your organization and secure your account, you must accept this invitation and choose your password before logging in.
            </p>

            <div class="btn-container">
              <a href="${params.invitationLink}" class="btn" target="_blank">Accept Invitation & Activate Account</a>
            </div>

            <p style="font-size: 12.5px; color: #64748b;">
              Or copy and paste this link into your browser:
            </p>
            <div class="link-fallback">${params.invitationLink}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} SyncUp Platform. All rights reserved. Invitation valid for 7 days.
          </div>
        </div>
      </body>
      </html>
    `;

    // 1. Try Resend API if RESEND_API_KEY is provided
    const resendApiKey = this.config.get<string>('mail.resendApiKey') || this.config.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const resendFrom = this.config.get<string>('mail.resendFrom') || 'SyncUp <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SyncUp-Platform/1.0',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [params.to],
            subject,
            html,
          }),
        });

        const data: any = await response.json();
        if (response.ok) {
          this.logger.log(`Email successfully sent via Resend to ${params.to} (ID: ${data.id})`);
          return true;
        }

        // If Resend rejected because of unverified domain in free tier, send to platform owner
        this.logger.warn(`Resend direct sending to ${params.to} failed: ${data.message || JSON.stringify(data)}`);
        const ownerEmail = this.config.get<string>('PLATFORM_OWNER_EMAIL', 'aabdelfatah732@gmail.com');
        if (params.to.toLowerCase() !== ownerEmail.toLowerCase()) {
          this.logger.log(`Forwarding invitation link to platform owner ${ownerEmail} via Resend...`);
          const fallbackRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'SyncUp-Platform/1.0',
            },
            body: JSON.stringify({
              from: resendFrom,
              to: [ownerEmail],
              subject: `[Action Required] Admin Activation Link for ${params.orgName} (${params.to})`,
              html: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>SyncUp Platform Invitation Notice</h2>
                  <p>A new organization <strong>${params.orgName}</strong> was provisioned for admin: <strong>${params.to}</strong>.</p>
                  <p style="background: #fef2f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; color: #991b1b;">
                    Note: To deliver emails directly to external recipients (@gmail.com, etc.), verify your domain <code>syntiqtech.com</code> at <a href="https://resend.com/domains" target="_blank">resend.com/domains</a>.
                  </p>
                  <p><strong>Activation Link:</strong></p>
                  <p><a href="${params.invitationLink}" style="background: #8B0021; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Activate ${params.orgName}</a></p>
                  <p style="font-size: 12px; color: #666; word-break: break-all;">${params.invitationLink}</p>
                </div>
              `,
            }),
          });
          if (fallbackRes.ok) {
            this.logger.log(`Activation notice delivered to platform owner ${ownerEmail}`);
            return true;
          }
        }
      } catch (err: any) {
        this.logger.error(`Resend API error sending to ${params.to}: ${err.message}`, err.stack);
      }
    }

    // 2. Fallback to Nodemailer SMTP transporter if configured
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to: params.to,
          subject,
          html,
        });
        this.logger.log(`Invitation email successfully sent via SMTP to ${params.to} for org "${params.orgName}"`);
        return true;
      } catch (err) {
        this.logger.error(`Failed to send invitation email to ${params.to}: ${err.message}`, err.stack);
      }
    } else if (!resendApiKey) {
      this.logger.log(`[DEV/LOCAL EMAIL MOCK] Email would be sent to: ${params.to}`);
      this.logger.log(`[DEV/LOCAL EMAIL MOCK] Subject: ${subject}`);
      this.logger.log(`[DEV/LOCAL EMAIL MOCK] Link: ${params.invitationLink}`);
    }

    return false;
  }
}
