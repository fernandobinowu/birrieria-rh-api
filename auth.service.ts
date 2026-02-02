import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      branch: dto.branch,
      displayName: dto.displayName,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      role: dto.role,
      passwordHash,
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.usersService.setRefreshTokenHash(user.id, await this.hashRefreshToken(tokens.refreshToken));

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.usersService.setRefreshTokenHash(user.id, await this.hashRefreshToken(tokens.refreshToken));

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshMatches = await argon2.verify(user.refreshTokenHash, dto.refreshToken);
    if (!refreshMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.usersService.setRefreshTokenHash(user.id, await this.hashRefreshToken(tokens.refreshToken));

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshTokenHash(userId);
    return { success: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'change-this';
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      '15m';

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change-this';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change-this';
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async hashRefreshToken(token: string) {
    return argon2.hash(token);
  }

  private sanitizeUser(user: {
    id: string;
    branch: string;
    createdAt: Date;
    updatedAt: Date;
    displayName: string | null;
    email: string;
    phoneNumber: string | null;
    role: string;
  }) {
    return {
      id: user.id,
      branch: user.branch,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };
  }
}
