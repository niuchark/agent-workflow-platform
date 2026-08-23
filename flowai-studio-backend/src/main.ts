/**
 * 后端服务入口：创建 Nest 应用并挂载全局安全、校验与响应处理。
 *
 * 启动时依次配置：
 * - helmet 安全头、CORS（前端地址白名单）；
 * - 全局 ValidationPipe（入参白名单校验 + 类型转换）；
 * - 统一响应格式拦截器与全局异常过滤器；
 * - 全局路由前缀 /api。
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/** 启动后端 HTTP 服务 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 安全加固：默认安全头
  app.use(helmet());

  // CORS 配置：仅允许前端来源跨域访问
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // 全局管道：剔除未声明字段并做 DTO 校验与类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局拦截器：所有成功响应统一为 { code, data, message } 结构
  app.useGlobalInterceptors(new ResponseInterceptor());

  // 全局过滤器：把异常统一转换为可读的错误响应
  app.useGlobalFilters(new AllExceptionsFilter());

  // 全局路由前缀：所有接口以 /api 开头
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Agent Flow Platform Backend is running on: http://localhost:${port}`);
}

// 启动服务
bootstrap();
