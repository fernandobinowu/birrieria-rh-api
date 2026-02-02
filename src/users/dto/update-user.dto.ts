export class UpdateUserDto {
  branch?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  passwordHash?: string;
  refreshTokenHash?: string | null;
}
