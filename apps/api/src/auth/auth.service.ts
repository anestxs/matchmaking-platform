import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { Prisma } from '@matchmaking/db';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { Profile } from 'passport-discord';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register({ nickname, tag, password, email }: RegisterDto) {
    const passwordHash = await argon2.hash(password);

    try {
      const user = await this.prisma.user.create({
        data: {
          nickname: nickname.toLowerCase(),
          tag,
          displayName: nickname,
          email: email?.toLowerCase(),
          passwordHash,
        },
        omit: { passwordHash: true },
      });
      const accessToken = await this.tokens.issueAccessToken(user.id);
      const refreshToken = await this.tokens.issueRefreshToken(user.id);

      return { user, accessToken, refreshToken };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target as string[] | undefined;

        if (target?.includes('email')) {
          throw new ConflictException('Email is already in use.');
        }
        throw new ConflictException('This nickname and tag are already taken.');
      }
      throw error;
    }
  }

  async login({ identifier, password }: LoginDto) {
    const user = await this.findByIdentifier(identifier);

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await argon2.verify(hash, password);

    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const { passwordHash: _removed, ...safeUser } = user;
    const accessToken = await this.tokens.issueAccessToken(user.id);
    const refreshToken = await this.tokens.issueRefreshToken(user.id);

    return { user: safeUser, accessToken, refreshToken };
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await this.tokens.revokeRefreshToken(refreshToken);
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async refresh(refreshToken: string) {
    return this.tokens.rotateRefreshToken(refreshToken);
  }

  private async findByIdentifier(identifier: string) {
    if (identifier.includes('#')) {
      const [nickname, tag] = identifier.split('#');
      return this.prisma.user.findUnique({
        where: { nickname_tag: { nickname: nickname.toLowerCase(), tag } },
      });
    }

    return this.prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
    });
  }

  private dummyHash: string | null = null;
  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await argon2.hash('timing-attack-placeholder');
    }
    return this.dummyHash;
  }

  async validateDiscordUser(profile: Profile) {
    const { id: discordId, username, global_name, email } = profile;

    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'DISCORD',
          providerAccountId: discordId,
        },
      },
    });

    if (account) {
      return { userId: account.userId };
    }

    if (!email) {
      throw new ConflictException(
        'Email is required for Discord authentication. Please ensure your Discord account has a verified email address.',
      );
    }

    const sanitedNickname = this.nicknameSanitizer(username);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const tag = this.generateTag();

        const user = await this.prisma.user.create({
          data: {
            nickname: sanitedNickname,
            tag: tag,
            email: email.toLowerCase(),
            displayName: global_name ?? sanitedNickname,
            emailVerifiedAt: new Date(),
            oauthAccounts: {
              create: {
                provider: 'DISCORD',
                providerAccountId: discordId,
              },
            },
          },
        });
        return { userId: user.id };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const target = error.meta?.target as string[] | undefined;

          if (target?.includes('email')) {
            throw new ConflictException('Email is already in use.');
          }
          continue; // Retry on unique constraint violation for nickname and tag
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Failed to generate a unique nickname and tag after multiple attempts.',
    );
  }

  private generateTag(): string {
    return randomInt(0, 10000).toString().padStart(4, '0');
  }

  private nicknameSanitizer(nickname: string | undefined): string {
    const sanitizedNickname =
      nickname
        ?.replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 20)
        .toLowerCase() || 'user';
    return sanitizedNickname.length < 3
      ? sanitizedNickname.padEnd(3, '0')
      : sanitizedNickname;
  }

  async setPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    if (user.passwordHash) {
      throw new ConflictException('Password is already set.');
    }

    const passwordHash = await argon2.hash(newPassword);

    return await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      omit: { passwordHash: true },
    });
  }

  async linkDiscordAccount(userId: string, profile: Profile) {
    try {
      await this.prisma.oAuthAccount.create({
        data: {
          userId,
          provider: 'DISCORD',
          providerAccountId: profile.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.oAuthAccount.findUnique({
          where: { userId_provider: { userId, provider: 'DISCORD' } },
        });

        if (existing) {
          throw new ConflictException(
            'This user already has a linked Discord account.',
          );
        }

        throw new ConflictException(
          'This Discord account is already linked to another user.',
        );
      }

      throw error;
    }
  }
}
