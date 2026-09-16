import { AuthService } from './auth.service';
import {
  Body,
  Controller,
  Delete,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { seconds, Throttle } from '@nestjs/throttler';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
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

  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
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
    return { success: true };
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
  discordAuth() {
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
  setPassword(
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
  discordLink() {
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

  @Delete('discord/unlink')
  @HttpCode(HttpStatus.OK)
  unlinkDiscord(@CurrentUser() user: { userId: string }) {
    return this.authService.unlinkDiscordAccount(user.userId);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: { userId: string },
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    const currentSid = await this.tokens.readSessionId(refreshToken);

    return this.authService.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
      currentSid,
    );
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('email/verify/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  requestEmailVerification(@CurrentUser() user: { userId: string }) {
    return this.authService.requestEmailVerification(user.userId);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
