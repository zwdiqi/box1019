/**
 * 成人源 / 普通源分类。
 *
 * 分类依据：测速阶段访问每个接口，读取返回的正文内容，与「成人源识别关键字」做子串匹配。
 * 正文中只要包含任意一个关键字（如视频标题、分类名里出现「麻豆」「成人」等），即标定为成人源（写入 av.json）；
 * 否则为普通源（写入 tv.json）。
 *
 * 对于不可通过 HTTP 探测的站点（type 3 爬虫源、非 http 地址），回退为仅按 api 网址链接做子串匹配。
 */

const DEFAULT_CJK = [
  '成人', '福利', '里番', '无码', '有码', '三级', '情色', '色情', '麻豆', '蜜桃',
  '天美', '果冻', '狼友', '妖姬', '含羞草', '小妲己', '羞羞', '18禁', '18+', '🔞',
  '午夜', '啪啪', '榴莲', '香蕉', '草莓', '幸福宝', '少妇', '人妻', '女优', '约炮',
  '乱伦', '援交', '禁片', '黄片', '性感', '尤物', '私房', '福利姬', '成人版',
  '激情', '杏吧', '海角', '糖心', '汤头条', '黑料', '国产精品', '番号',
  '湿乐园', '色猫', '老色', '色仓库', 'x色', '美少女', '白嫖',
];

const DEFAULT_LATIN = [
  'porn', 'xxx', 'adult', 'hentai', 'javhd', '91porn', '18av', 'avmoo', 'sehuatang',
  'madou', 'pron', 'nsfw', 'swag', 'onlyfans', 'pornhub', 'xvideos', 'xhamster',
  'spankbang', 'missav', 'jable', 'avgle', 'javbus', 'javdb', 'avsee', 'hanime',
  'nhentai', '18comic', 'hsex',
  // 域名中常见的成人标识（子串匹配，命中即判定为成人源）
  'av', '91md',
];

export const DEFAULT_ADULT_KEYWORDS = [...DEFAULT_CJK, ...DEFAULT_LATIN];

/**
 * @param {object} site 归一化后的站点
 * @param {string[]} keywords 关键字表
 * @returns {'av'|'tv'}
 */
export function classifySite(site, keywords) {
  const words = Array.isArray(keywords) && keywords.length ? keywords : DEFAULT_ADULT_KEYWORDS;
  const api = typeof site.api === 'string' ? site.api : '';
  // 仅基于 api 网址链接做子串匹配；把 a-v / a_v / a.v 归一化为 av，兼容连字符写法
  const haystack = api.toLowerCase().replace(/([a-z])[._-]([a-z])/g, '$1$2');

  for (const raw of words) {
    const token = String(raw || '').trim().toLowerCase();
    if (!token) continue;
    if (haystack.includes(token)) return 'av';
  }
  return 'tv';
}

/**
 * 基于接口返回的正文内容做分类：内容中只要包含任意一个成人关键字，即标定为成人源。
 * 用于测速阶段同时抓取响应正文后判定（比仅看 api 网址更准确）。
 *
 * @param {string} text 接口响应正文（限长）
 * @param {string[]} keywords 关键字表
 * @returns {'av'|'tv'}
 */
export function classifyByContent(text, keywords) {
  const words = Array.isArray(keywords) && keywords.length ? keywords : DEFAULT_ADULT_KEYWORDS;
  if (typeof text !== 'string' || !text) return 'tv';
  const haystack = text.toLowerCase().replace(/([a-z])[._-]([a-z])/g, '$1$2');

  for (const raw of words) {
    const token = String(raw || '').trim().toLowerCase();
    if (!token) continue;
    if (haystack.includes(token)) return 'av';
  }
  return 'tv';
}
