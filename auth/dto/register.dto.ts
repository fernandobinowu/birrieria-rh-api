import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  branch: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  role: string;

  @MinLength(8)
  password: string;
}
