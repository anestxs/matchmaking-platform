import { AuthService } from './auth.service';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { TokenService } from './token.service';
import { SetPasswordDto } from './dto/set-password.dto';
import { DiscordLinkGuard } from './guards/discord-link.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);

    return { user, accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);

    return { user, accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    await this.authService.logout(token);

    res.clearCookie('refresh_token', { path: '/auth' });
    return { sucess: true };
  }

  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.authService.me(user.userId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('No refresh token.');
    }

    const { accessToken, refreshToken } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: Number(this.config.getOrThrow<string>('JWT_REFRESH_TTL')) * 1000,
    });
  }

  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get('discord')
  async discordAuth() {
    // This route is protected by the DiscordAuthGuard, which will handle the redirect to Discord for authentication.
  }

  @Public()
  @UseGuards(DiscordAuthGuard)
  @Get('discord/callback')
  async discordAuthCallback(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const refreshToken = await this.tokens.issueRefreshToken(user.userId);
    this.setRefreshCookie(res, refreshToken);
    res.redirect(this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @CurrentUser() user: { userId: string },
    @Body() dto: SetPasswordDto,
  ) {
    return this.authService.setPassword(user.userId, dto.password);
  }

  @Post('discord/link/token')
  @HttpCode(HttpStatus.OK)
  async createDiscordLinkToken(@CurrentUser() user: { userId: string }) {
    const token = await this.tokens.issueLinkToken(user.userId);
    return { token };
  }

  @Public()
  @UseGuards(DiscordLinkGuard)
  @Get('discord/link')
  async discordLink() {
    // This route is protected by the DiscordLinkGuard, which will handle the redirect to Discord for linking.
  }

  @Public()
  @UseGuards(DiscordLinkGuard)
  @Get('discord/link/callback')
  discordLinkCallback(@Res() res: Response) {
    res.redirect(
      `${this.config.getOrThrow<string>('FRONTEND_URL')}/settings?linked=discord`,
    );
  }
}
