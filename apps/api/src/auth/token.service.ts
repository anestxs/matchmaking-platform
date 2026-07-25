import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issueAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }
}
