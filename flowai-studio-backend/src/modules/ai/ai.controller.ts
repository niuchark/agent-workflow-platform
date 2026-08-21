/**
 * AI 控制器：工作流运行、SSE 流式对话与聊天历史。
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { StreamRunDto, RunDto, ChatDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** AI REST 控制器 */
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** 运行应用/工作流并返回结果 */
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(
    @CurrentUser('userId') userId: string,
    @Body() runDto: RunDto,
  ) {
    return this.aiService.run(userId, runDto);
  }

  /** 流式运行应用/工作流（SSE） */
  @Post('stream-run')
  @UseGuards(JwtAuthGuard)
  async streamRun(
    @CurrentUser('userId') userId: string,
    @Body() streamRunDto: StreamRunDto,
    @Res() res: Response,
  ) {
    await this.aiService.streamRun(userId, streamRunDto, res);
  }

  /** 对话（SSE 流式回复，可关联知识库） */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @CurrentUser('userId') userId: string,
    @Body() chatDto: ChatDto,
    @Res() res: Response,
  ) {
    await this.aiService.chat(userId, chatDto, res);
  }

  /** 获取某会话的聊天历史 */
  @Get('chat-histories/:sessionId')
  @UseGuards(JwtAuthGuard)
  async getChatHistory(
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.aiService.getChatHistory(userId, sessionId);
  }

  /** 获取全部聊天会话（可按应用过滤） */
  @Get('chat-histories')
  @UseGuards(JwtAuthGuard)
  async getAllChatHistories(
    @CurrentUser('userId') userId: string,
    @Query('appId') appId?: string,
  ) {
    return this.aiService.getAllChatHistories(userId, appId);
  }
}
