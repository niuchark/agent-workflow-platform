/** 更新个人资料 DTO：登录用户名和用户 ID 均不可修改。 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 当前用户可修改的公开资料字段。 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Avatar must be a string' })
  @MaxLength(2048, { message: 'Avatar URL is too long' })
  avatar?: string;
}
