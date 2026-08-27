/**
 * 内置技能实现：时间、HTTP、JSON、正则与安全计算器。
 */
import axios from 'axios';

type RequestUrlValidator = (url: string) => Promise<string>;

/** 按类型分发到对应的内置技能执行器 */
export async function executeBuiltinSkill(
  type: string,
  params: Record<string, any>,
  validateRequestUrl?: RequestUrlValidator,
): Promise<any> {
  switch (type) {
    case 'time':
      return executeTimeSkill();
    case 'http':
      return executeHttpSkill(params, validateRequestUrl);
    case 'json':
      return executeJsonSkill(params);
    case 'regex':
      return executeRegexSkill(params);
    case 'calculator':
      return executeCalculatorSkill(params);
    case 'code':
      throw new Error('代码执行已禁用；请使用进程外、资源受限的专用执行器');
    default:
      throw new Error(`Unknown builtin skill type: ${type}`);
  }
}

/** 时间技能：返回当前时间 */
function executeTimeSkill(): any {
  const now = new Date();
  return {
    datetime: now.toISOString(),
    timestamp: now.getTime(),
    date: now.toDateString(),
    time: now.toTimeString(),
  };
}

async function executeHttpSkill(
  params: Record<string, unknown>,
  validateRequestUrl?: RequestUrlValidator,
): Promise<unknown> {
  const { url, method = 'GET', headers = {}, body } = params;

  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('URL is required for HTTP skill');
  }
  if (!validateRequestUrl) {
    throw new Error('HTTP skill URL validator is not configured');
  }

  const safeUrl = await validateRequestUrl(url);

  try {
    const response = await axios({
      url: safeUrl,
      method: typeof method === 'string' ? method : 'GET',
      headers: typeof headers === 'object' && headers !== null ? headers : {},
      data: body,
      timeout: 10000, // 10 秒超时
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 2 * 1024 * 1024,
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(`HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function executeJsonSkill(params: any): any {
  const { action, data } = params;

  if (!action) {
    throw new Error('Action is required for JSON skill');
  }

  switch (action) {
    case 'parse':
      if (typeof data !== 'string') {
        throw new Error('Data must be a string for parse action');
      }
      try {
        return { result: JSON.parse(data) };
      } catch (error) {
        throw new Error('Invalid JSON');
      }
    case 'stringify':
      try {
        return { result: JSON.stringify(data) };
      } catch (error) {
        throw new Error('Failed to stringify data');
      }
    default:
      throw new Error(`Unknown JSON action: ${action}`);
  }
}

function executeRegexSkill(params: any): any {
  const { text, pattern, flags = '' } = params;

  if (!text || !pattern) {
    throw new Error('Text and pattern are required for regex skill');
  }

  try {
    const regex = new RegExp(pattern, flags);
    const matches = text.match(regex);

    return {
      matches: matches || [],
      groups: matches?.groups || {},
    };
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function executeCalculatorSkill(params: Record<string, unknown>): { expression: string; result: number } {
  const { expression } = params;

  if (!expression || typeof expression !== 'string') {
    throw new Error('expression (string) is required for calculator skill');
  }

  if (expression.length > 256) {
    throw new Error('Invalid expression: maximum length is 256 characters');
  }

  try {
    const result = new ArithmeticParser(expression).parse();

    if (!Number.isFinite(result)) {
      throw new Error('Expression did not evaluate to a valid number');
    }

    return { expression, result };
  } catch (error) {
    throw new Error(`Calculator error: ${error instanceof Error ? error.message : 'Invalid expression'}`);
  }
}

/**
 * 只解析数字与 + - * / % ^ 括号的递归下降计算器。
 * 不调用 eval/vm，也不会把用户表达式当作 JavaScript 执行。
 */
class ArithmeticParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.parseAdditive();
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      throw new Error(`Unexpected token at position ${this.index + 1}`);
    }
    return value;
  }

  private parseAdditive(): number {
    let value = this.parseMultiplicative();
    while (true) {
      if (this.consume('+')) value += this.parseMultiplicative();
      else if (this.consume('-')) value -= this.parseMultiplicative();
      else return value;
    }
  }

  private parseMultiplicative(): number {
    let value = this.parsePower();
    while (true) {
      if (this.consume('*')) value *= this.parsePower();
      else if (this.consume('/')) value /= this.parsePower();
      else if (this.consume('%')) value %= this.parsePower();
      else return value;
    }
  }

  /** 指数运算右结合：2^3^2 等价于 2^(3^2) */
  private parsePower(): number {
    const base = this.parseUnary();
    return this.consume('^') ? Math.pow(base, this.parsePower()) : base;
  }

  private parseUnary(): number {
    if (this.consume('+')) return this.parseUnary();
    if (this.consume('-')) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    if (this.consume('(')) {
      const value = this.parseAdditive();
      if (!this.consume(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    this.skipWhitespace();
    const match = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw new Error(`Expected a number at position ${this.index + 1}`);
    this.index += match[0].length;
    return Number(match[0]);
  }

  private consume(token: string): boolean {
    this.skipWhitespace();
    if (!this.source.startsWith(token, this.index)) return false;
    this.index += token.length;
    return true;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] || '')) this.index += 1;
  }
}
