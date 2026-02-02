export class CreateUserDto {
  branch: string;
  displayName?: string;
  email: string;
  phoneNumber?: string;
  role: string;
  passwordHash: string;
}
