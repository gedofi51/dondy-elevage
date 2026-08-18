import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1026),
      secure: false,
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
    this.from = this.config.get<string>('MAIL_FROM', 'DONDY ELEVAGE <no-reply@dondy-elevage.cf>');
  }

  private async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      // Envoi non bloquant : une panne SMTP ne doit jamais faire échouer
      // l'action métier qui a déclenché l'email (création de compte,
      // demande de reset...).
      this.logger.error(`Échec d'envoi d'email à ${options.to}`, error);
    }
  }

  async envoyerInvitation(to: string, nom: string, lienActivation: string): Promise<void> {
    await this.send({
      to,
      subject: 'Votre compte DONDY ELEVAGE',
      html: `
        <p>Bonjour ${escapeHtml(nom)},</p>
        <p>Un compte DONDY ELEVAGE a été créé pour vous. Activez-le et choisissez votre mot de passe :</p>
        <p><a href="${lienActivation}">${lienActivation}</a></p>
        <p>Ce lien expire dans 48 heures.</p>
      `,
    });
  }

  async envoyerReinitialisationMotDePasse(to: string, lienReset: string): Promise<void> {
    await this.send({
      to,
      subject: 'Réinitialisation de votre mot de passe — DONDY ELEVAGE',
      html: `
        <p>Une demande de réinitialisation de mot de passe a été faite pour ce compte.</p>
        <p>Si vous êtes à l'origine de cette demande, cliquez sur ce lien (valable 1 heure) :</p>
        <p><a href="${lienReset}">${lienReset}</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
