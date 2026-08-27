/**
 * 用户控制器：注册、登录、获取/更新个人资料。
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** 用户 REST 控制器 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 注册新用户 */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.userService.register(registerDto);
  }

  /** 登录并返回 token 与用户信息 */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.userService.login(loginDto);
  }

  /** 获取当前用户资料 */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.userService.getProfile(userId);
  }

  /** 更新当前用户资料 */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() data: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, data);
  }
}
