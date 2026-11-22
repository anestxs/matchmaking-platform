import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MailTemplate } from './templates';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.getOrThrow<string>('SMTP_PORT')),
      secure: false,
    });
  }

  async send(to: string, template: MailTemplate): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.getOrThrow<string>('MAIL_FROM'),
      to,
      ...template,
    });
  }
}
