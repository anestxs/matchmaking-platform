import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';
import type { Request } from 'express';

@Injectable()
export class DiscordLinkStrategy extends PassportStrategy(
  Strategy,
  'discord-link',
) {
  constructor(
    config: ConfigService,
    private readonly tokens: TokenService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('DISCORD_LINK_CALLBACK_URL'),
      scope: ['identify'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const userId = await this.tokens.verifyLinkToken(req.query.state as string);
    await this.authService.linkDiscordAccount(userId, profile);

    return { userId };
  }
}
