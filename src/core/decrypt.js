/**
 * 订阅源自动解密。
 *
 * TVBox 生态里常见的「加密源」手法：
 *   1. 直接返回 JSON（无需解密）
 *   2. 返回 base64 编码的 JSON（可能带 `**` 分隔符）
 *   3. 把 base64 JSON 藏在图片（JPEG/PNG/GIF/BMP）末尾，靠 Content-Type 伪装
 *
 * 本模块按顺序尝试上述方式，返回可被 JSON.parse 解析的字符串；全部失败返回 null。
 */

/** 判断字节流是否是图片（JPEG / PNG / GIF / BMP） */
export function isImage(bytes) {
  if (!bytes || bytes.length < 2) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return false;
}

/** 提取图片结束标记之后的附加数据，转为文本 */
export function extractAfterImage(bytes) {
  const kind = isImage(bytes);
  if (!kind) return null;

  let endOffset = -1;

  if (kind === 'jpeg') {
    // JPEG 以 FF D9 结尾，从后往前找最后一个
    for (let i = bytes.length - 2; i >= 0; i--) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        endOffset = i + 2;
        break;
      }
    }
  } else if (kind === 'png') {
    // PNG 以 IEND 块结尾: 49 45 4E 44 AE 42 60 82
    const iend = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    for (let i = 0; i <= bytes.length - 8; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (bytes[i + j] !== iend[j]) { match = false; break; }
      }
      if (match) { endOffset = i + 8; break; }
    }
  } else if (kind === 'gif') {
    // GIF 以 0x3B 结尾
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x3b) { endOffset = i + 1; break; }
    }
  } else if (kind === 'bmp') {
    // BMP 头里第 2-6 字节是文件大小（小端）
    if (bytes.length >= 6) {
      const fileSize = bytes[2] | (bytes[3] << 8) | (bytes[4] << 16) | (bytes[5] << 24);
      if (fileSize > 0 && fileSize < bytes.length) endOffset = fileSize;
    }
  }

  if (endOffset < 0 || endOffset >= bytes.length) return null;
  const tail = bytes.subarray(endOffset);
  // 去掉开头可能的空白/换行
  let start = 0;
  while (start < tail.length && (tail[start] === 0x0a || tail[start] === 0x0d || tail[start] === 0x20)) start++;
  if (start >= tail.length) return null;
  return new TextDecoder('utf-8').decode(tail.subarray(start));
}

/** 判断字符串是否是 base64 编码（允许少量非 base64 字符如 **） */
function looksLikeBase64(s) {
  if (!s || s.length < 8) return false;
  // 快速预检：扫前 200 字符，若含明显非 base64 字符（< > 空格 中文等）直接排除
  const scanLen = Math.min(s.length, 200);
  let nonB64 = 0;
  for (let i = 0; i < scanLen; i++) {
    const c = s.charCodeAt(i);
    const isB64 = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47 || c === 61;
    if (!isB64) nonB64++;
  }
  // 允许少量分隔符（**、换行），但超过 30% 非 base64 字符就不是
  if (nonB64 / scanLen > 0.3) return false;
  const cleaned = s.replace(/[^A-Za-z0-9+/=]/g, '');
  if (cleaned.length < 8) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}

/** base64 解码（兼容 ** 分隔符：取最长那段；没有则用整段） */
function base64Decode(s) {
  let payload = s;
  if (s.includes('**')) {
    const parts = s.split('**');
    // 取最长的那段作为有效载荷
    payload = parts.reduce((a, b) => (b.length > a.length ? b : a), '');
  }
  const cleaned = payload.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!cleaned) return null;
  // 优先用原生 atob（Worker 环境），失败回退到纯 JS 实现
  try {
    return atob(cleaned);
  } catch {
    return base64DecodePure(cleaned);
  }
}

/** 纯 JS base64 解码（兼容不支持 atob 的环境） */
function base64DecodePure(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(128);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const val = (ch) => (ch === 61 ? 64 : lookup[ch]); // '=' 作为填充标记
  let output = '';
  let i = 0;
  while (i < str.length) {
    const a = val(str.charCodeAt(i++));
    const b = val(str.charCodeAt(i++));
    const c = val(str.charCodeAt(i++));
    const d = val(str.charCodeAt(i++));
    const x = (a << 18) | (b << 12) | (c << 6) | d;
    if (c === 64) output += String.fromCharCode((x >> 16) & 0xff);
    else if (d === 64) output += String.fromCharCode((x >> 16) & 0xff, (x >> 8) & 0xff);
    else output += String.fromCharCode((x >> 16) & 0xff, (x >> 8) & 0xff, x & 0xff);
  }
  return output;
}

/** 从解码后的文本里截取完整 JSON 对象（去掉末尾多余字节，并剥离 // 行注释） */
function extractJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const end = text.lastIndexOf('}');
  if (end < start) return null;
  let candidate = text.substring(start, end + 1);
  // 剥离 // 行注释（TVBox 配置里常见，标准 JSON 不支持）
  // 只删除行首（允许前导空白）的 // 注释，避免误伤字符串内的 //
  candidate = candidate.replace(/^[ \t]*\/\/.*$/gm, '');
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

/**
 * 尝试对获取到的内容做解密，返回可解析的 JSON 字符串；无法解密返回 null。
 *
 * @param {string} text  响应体解码后的文本
 * @param {Uint8Array} [bytes]  响应体原始字节（用于检测图片伪装）
 */
export function decryptContent(text, bytes) {
  if (!text) return null;

  // 快速排除 HTML/XML（测速阶段大量接口返回 HTML 错误页，无需解密）
  const first = text.charCodeAt(0);
  if (first === 60 /* '<' */) return null;

  // ① 本身就是 JSON
  try {
    JSON.parse(text);
    return text;
  } catch { /* 继续 */ }

  // ② 图片伪装：从图片末尾提取附加数据
  if (bytes && isImage(bytes)) {
    const embedded = extractAfterImage(bytes);
    if (embedded) {
      // 提取到的数据可能是 base64，也可能直接是 JSON
      const direct = extractJson(embedded);
      if (direct) return direct;
      if (looksLikeBase64(embedded)) {
        const decoded = base64Decode(embedded);
        if (decoded) {
          const json = extractJson(decoded);
          if (json) return json;
        }
      }
    }
  }

  // ③ 直接是 base64（含 ** 分隔符）
  if (looksLikeBase64(text)) {
    const decoded = base64Decode(text);
    if (decoded) {
      const json = extractJson(decoded);
      if (json) return json;
    }
  }

  return null;
}
