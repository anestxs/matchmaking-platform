import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { OAuthLoginException } from '../exceptions/oauth-login.exception';

@Catch()
@Injectable()
export class DiscordLoginErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DiscordLoginErrorFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const reason =
      exception instanceof OAuthLoginException ? exception.reason : 'failed';

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Discord sign-in failed unexpectedly',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const target = new URL(
      '/login',
      this.config.getOrThrow<string>('FRONTEND_URL'),
    );
    target.searchParams.set('error', `discord_${reason}`);

    response.redirect(target.toString());
  }
}
