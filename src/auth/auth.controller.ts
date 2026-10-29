import {
  Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login — returns access + refresh tokens.
   * Only invited users (existing in DB) can log in.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access & refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Accept invitation + set password + create account.
   * This is how ALL users (including org admins) join SyncUp.
   */
  @Public()
  @Post('accept-invitation')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept invitation and activate account' })
  @ApiResponse({ status: 201, description: 'Account activated, returns tokens' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto);
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refreshTokens(@CurrentUser() user: any, @Body() _dto: RefreshTokenDto) {
    return this.authService.refreshTokens(user.sub, user.email, user.isPlatformOwner);
  }

  /**
   * Change password — requires current password.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  /**
   * Logout — client should discard tokens.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout current session' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  /**
   * Get current authenticated user info.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user info' })
  getMe(@CurrentUser() user: any) {
    return user;
  }
}
