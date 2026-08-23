/**
 * 修复 multipart 文件名被按 Latin-1 解码后的乱码。
 *
 * Multer/Busboy 在不同 Node 与代理组合下可能把 UTF-8 文件名头按 Latin-1
 * 解释，例如把“功能介绍.md”变成对应的乱码字节串。这里只在原字符串完全
 * 落在单字节范围、且重新解码得到有效 UTF-8 时转换，避免破坏本来就正确的
 * 中文、日文、Emoji 或带重音字符文件名。
 */
export function normalizeUploadFilename(fileName: string): string {
  if (!fileName) return fileName;

  const containsNonLatin1CodePoint = /[^\u0000-\u00ff]/.test(fileName);
  const containsHighByte = /[\u0080-\u00ff]/.test(fileName);
  if (containsNonLatin1CodePoint || !containsHighByte) return fileName;

  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  if (decoded === fileName || decoded.includes('\ufffd')) return fileName;

  return decoded;
}
