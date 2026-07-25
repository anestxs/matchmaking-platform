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

      return { user, accessToken };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target as string[] | undefined;

        if (target?.includes('email')) {
          throw new ConflictException('Email is already in use');
        }
        throw new ConflictException('This nickname and tag are already taken');
      }
      throw error;
    }
  }

  async login({ identifier, password }: LoginDto) {
    const user = await this.findByIdentifier(identifier);

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await argon2.verify(hash, password);

    if (!user || !user.passwordHash || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _removed, ...safeUser } = user;
    const accessToken = await this.tokens.issueAccessToken(user.id);
    return { user: safeUser, accessToken };
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
}
