/**
 * RAG 控制器：知识库管理、文档上传/删除/分块查询与统一检索接口。
 *
 * 检索支持三种模式（vector/keyword/hybrid），可在请求中覆盖
 * topK、retrievalMode、vectorWeight、rrfK 等参数。
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RAGService } from './services/rag.service';
import { CreateKnowledgeBaseDto } from './dto/create-kb.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-kb.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RAGController {
  constructor(private readonly ragService: RAGService) {}

  // ===== 知识库管理 =====
  /** 创建知识库 */
  @Post('knowledge-bases')
  createKnowledgeBase(
    @CurrentUser('userId') userId: string,
    @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto,
  ) {
    return this.ragService.createKnowledgeBase(userId, createKnowledgeBaseDto);
  }

  /** 获取知识库列表 */
  @Get('knowledge-bases')
  findKnowledgeBases(@CurrentUser('userId') userId: string) {
    return this.ragService.findKnowledgeBases(userId);
  }

  /** 获取知识库详情 */
  @Get('knowledge-bases/:id')
  findKnowledgeBaseById(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ragService.findKnowledgeBaseById(userId, id);
  }

  /** 更新知识库配置 */
  @Patch('knowledge-bases/:id')
  updateKnowledgeBase(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto,
  ) {
    return this.ragService.updateKnowledgeBase(userId, id, updateKnowledgeBaseDto);
  }

  /** 删除知识库 */
  @Delete('knowledge-bases/:id')
  deleteKnowledgeBase(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ragService.deleteKnowledgeBase(userId, id);
  }

  // ===== 文档管理 =====
  /** 上传文档（multipart，后台异步向量化） */
  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser('userId') userId: string,
    @Body('knowledgeBaseId') knowledgeBaseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ragService.uploadDocument(userId, knowledgeBaseId, file);
  }

  /** 获取文档分块 */
  @Get('documents/:documentId/chunks')
  getDocumentChunks(
    @CurrentUser('userId') userId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.ragService.getDocumentChunks(userId, documentId);
  }

  /** 删除文档 */
  @Delete('documents/:documentId')
  deleteDocument(
    @CurrentUser('userId') userId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.ragService.deleteDocument(userId, documentId);
  }

  /**
   * 统一检索接口
   *
   * Phase 2.2 增强:
   * - 支持三种检索模式: vector / keyword / hybrid
   * - hybrid 模式使用 RRF 融合向量+关键词结果
   * - 支持检索参数覆盖: topK, retrievalMode, vectorWeight, rrfK
   *
   * 竞品对标:
   * - Dify: POST /datasets/{id}/retrieve 支持检索模式选择
   * - FastGPT: POST /api/core/dataset/searchTest
   * - 本设计: 支持运行时覆盖检索参数（更灵活）
   */
  /** 统一检索接口：按知识库配置的检索模式执行 */
  @Post('retrieve')
  retrieve(
    @CurrentUser('userId') userId: string,
    @Body('query') query: string,
    @Body('knowledgeBaseId') knowledgeBaseId: string,
    @Body('topK') topK?: number,
    @Body('retrievalMode') retrievalMode?: 'vector' | 'keyword' | 'hybrid',
    @Body('vectorWeight') vectorWeight?: number,
    @Body('rrfK') rrfK?: number,
  ) {
    return this.ragService.retrieve(
      userId,
      query,
      knowledgeBaseId,
      topK,
      retrievalMode,
      vectorWeight,
      rrfK,
    );
  }
}
