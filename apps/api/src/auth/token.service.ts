import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

interface RefreshPayload {
  sub: string;
  sid: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async issueAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }

  async issueRefreshTokeh(userId: string): Promise<string> {
    const sid = randomUUID();
    const jti = randomUUID();

    await this.storeSession(sid, userId, jti);
    return this.signRefreshToken(userId, sid, jti);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      await this.redis.del(this.sessionKey(payload.sid));
    } catch {
      return;
    }
  }

  private sessionKey(sid: string): string {
    return `refresh_session:${sid}`;
  }

  private refreshTtlSeconds(): number {
    return Number(this.config.getOrThrow('JWT_REFRESH_TTL'));
  }

  private async storeSession(sid: string, userId: string, jti: string) {
    await this.redis.set(
      this.sessionKey(sid),
      JSON.stringify({ userId, jti }),
      'EX',
      this.refreshTtlSeconds(),
    );
  }

  private signRefreshToken(userId: string, sid: string, jti: string) {
    return this.jwt.signAsync(
      { sub: userId, sid, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTtlSeconds(),
      },
    );
  }

  async rotateRefreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const raw = await this.redis.get(this.sessionKey(payload.sid));
    if (!raw) {
      throw new UnauthorizedException('Session expired');
    }
    const session = JSON.parse(raw) as { userId: string; jti: string };

    if (session.jti !== payload.jti) {
      await this.redis.del(this.sessionKey(payload.sid));
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const newJti = randomUUID();
    await this.storeSession(payload.sid, session.userId, newJti);
    const refreshToken = await this.signRefreshToken(
      session.userId,
      payload.sid,
      newJti,
    );
    const accessToken = await this.issueAccessToken(session.userId);
    return { accessToken, refreshToken };
  }
}
