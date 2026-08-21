/**
 * 更新应用 DTO：所有字段可选（继承 CreateAppDto 的校验规则）。
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateAppDto } from './create-app.dto';

/** 更新应用的请求体（部分字段） */
export class UpdateAppDto extends PartialType(CreateAppDto) {}
