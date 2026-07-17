import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserCount(): Promise<number> {
    const count = await this.prisma.user.count();
    return count;
  }

  getHello(): string {
    return 'Hello World!';
  }
}
