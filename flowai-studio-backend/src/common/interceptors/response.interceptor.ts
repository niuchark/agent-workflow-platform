/**
 * 统一响应拦截器：所有成功响应包装为固定结构。
 *
 * { success, code, message, data, timestamp }
 * 与 AllExceptionsFilter 的错误响应结构对齐，方便前端统一处理。
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 统一成功响应结构 */
export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

/** 响应拦截器：把 controller 返回值包装为 ApiResponse */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        code: 'SUCCESS',
        message: 'Success',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
