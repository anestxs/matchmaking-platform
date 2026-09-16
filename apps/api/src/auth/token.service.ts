import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { createHash, randomBytes, randomUUID } from 'crypto';

interface RefreshPayload {
  sub: string;
  sid: string;
  jti: string;
}

interface LinkTokenPayload {
  sub: string;
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

  async issueRefreshToken(userId: string): Promise<string> {
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
      await this.removeSession(payload.sid, payload.sub);
    } catch {
      return;
    }
  }

  private sessionKey(sid: string): string {
    return `refresh_session:${sid}`;
  }

  private userSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  private refreshTtlSeconds(): number {
    return Number(this.config.getOrThrow('JWT_REFRESH_TTL'));
  }

  private async storeSession(sid: string, userId: string, jti: string) {
    const ttl = this.refreshTtlSeconds();
    const now = Math.floor(Date.now() / 1000);
    const indexKey = this.userSessionsKey(userId);

    await this.redis
      .multi()
      .set(this.sessionKey(sid), JSON.stringify({ userId, jti }), 'EX', ttl)
      .zadd(indexKey, now + ttl, sid)
      .zremrangebyscore(indexKey, '-inf', now)
      .expire(indexKey, ttl)
      .exec();
  }

  private async removeSession(sid: string, userId: string) {
    const indexKey = this.userSessionsKey(userId);

    await this.redis
      .multi()
      .del(this.sessionKey(sid))
      .zrem(indexKey, sid)
      .exec();
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
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const raw = await this.redis.get(this.sessionKey(payload.sid));
    if (!raw) {
      throw new UnauthorizedException('Session expired.');
    }
    const session = JSON.parse(raw) as { userId: string; jti: string };

    if (session.jti !== payload.jti) {
      await this.removeSession(payload.sid, session.userId);
      throw new UnauthorizedException('Refresh token reuse detected.');
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

  async issueLinkToken(userId: string): Promise<string> {
    const jti = randomUUID();
    await this.redis.set(
      this.linkTokenKey(jti),
      userId,
      'EX',
      this.linkTtlSeconds(),
    );

    return this.jwt.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_LINK_SECRET'),
        expiresIn: this.linkTtlSeconds(),
      },
    );
  }

  async verifyLinkToken(token: string): Promise<string> {
    let payload: LinkTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<LinkTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_LINK_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired link token.');
    }

    const deleted = await this.redis.del(this.linkTokenKey(payload.jti));
    if (deleted === 0) {
      throw new UnauthorizedException('Link token already used.');
    }

    return payload.sub;
  }

  private linkTokenKey(jti: string) {
    return `link_token:${jti}`;
  }
  private linkTtlSeconds(): number {
    return Number(this.config.getOrThrow('JWT_LINK_TTL'));
  }

  async revokeAllSessions(userId: string, exceptSid?: string): Promise<void> {
    const indexKey = this.userSessionsKey(userId);
    const sids = await this.redis.zrange(indexKey, 0, -1);
    const toRevoke = sids.filter((sid) => sid !== exceptSid);

    if (toRevoke.length === 0) {
      return;
    }

    const pipeline = this.redis.multi();
    for (const sid of toRevoke) {
      pipeline.del(this.sessionKey(sid));
    }
    pipeline.zrem(indexKey, ...toRevoke);
    await pipeline.exec();
  }

  async readSessionId(token: string | undefined): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }

    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      return payload.sid;
    } catch {
      return undefined;
    }
  }

  async issueOneTimeToken(
    prefix: string,
    userId: string,
    ttlSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.redis.set(
      this.oneTimeTokenKey(prefix, token),
      userId,
      'EX',
      ttlSeconds,
    );

    return token;
  }

  async consumeOneTimeToken(
    prefix: string,
    token: string,
  ): Promise<string | null> {
    return await this.redis.getdel(this.oneTimeTokenKey(prefix, token));
  }

  private oneTimeTokenKey(prefix: string, token: string): string {
    const hash = createHash('sha256').update(token).digest('hex');

    return `${prefix}:${hash}`;
  }

  async issueEmailVerificationToken(userId: string): Promise<string> {
    return this.issueOneTimeToken(
      'email_verification',
      userId,
      this.emailVerificationTtlSeconds(),
    );
  }

  async consumeEmailVerificationToken(token: string): Promise<string> {
    const userId = await this.consumeOneTimeToken('email_verification', token);

    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    return userId;
  }

  private emailVerificationTtlSeconds(): number {
    return Number(this.config.getOrThrow<string>('EMAIL_VERIFICATION_TTL'));
  }

  async issuePasswordResetToken(userId: string): Promise<string> {
    return this.issueOneTimeToken(
      'password_reset',
      userId,
      this.passwordResetTtlSeconds(),
    );
  }

  async consumePasswordResetToken(token: string): Promise<string> {
    const userId = await this.consumeOneTimeToken('password_reset', token);

    if (!userId) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    return userId;
  }

  private passwordResetTtlSeconds(): number {
    return Number(this.config.getOrThrow<string>('PASSWORD_RESET_TTL'));
  }
}
