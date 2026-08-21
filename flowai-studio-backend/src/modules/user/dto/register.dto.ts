/**
 * 注册 DTO：用户名（3–20 位字母数字下划线）+ 密码（至少 6 位）。
 */
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/** 注册请求体 */
export class RegisterDto {
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
