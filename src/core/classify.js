/**
 * 成人源 / 普通源分类。
 *
 * 中文关键字直接做子串匹配（中文没有词边界问题）；
 * 拉丁字母关键字用边界正则匹配，避免 "av" 命中 "java"、"save" 这类误判。
 */

const DEFAULT_CJK = [
  '成人', '福利', '里番', '无码', '有码', '三级', '情色', '色情', '麻豆', '蜜桃',
  '天美', '果冻', '狼友', '妖姬', '含羞草', '小妲己', '羞羞', '18禁', '18+', '🔞',
  '午夜', '啪啪', '榴莲', '香蕉', '草莓', '幸福宝', '少妇', '人妻', '女优', '约炮',
  '乱伦', '援交', '禁片', '黄片', '性感', '尤物', '私房', '福利姬', '成人版',
  '激情', '杏吧', '海角', '糖心', '汤头条', '黑料', '国产精品', '番号',
];

const DEFAULT_LATIN = [
  'porn', 'xxx', 'adult', 'hentai', 'javhd', '91porn', '18av', 'avmoo', 'sehuatang',
  'madou', 'pron', 'nsfw', 'swag', 'onlyfans', 'pornhub', 'xvideos', 'xhamster',
  'spankbang', 'missav', 'jable', 'avgle', 'javbus', 'javdb', 'avsee', 'hanime',
  'nhentai', '18comic', 'hsex',
];

export const DEFAULT_ADULT_KEYWORDS = [...DEFAULT_CJK, ...DEFAULT_LATIN];

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const latinCache = new Map();

function latinRegex(token) {
  const key = String(token).toLowerCase();
  if (latinCache.has(key)) return latinCache.get(key);
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(key)}([^a-z0-9]|$)`, 'i');
  latinCache.set(key, re);
  return re;
}

const hasCJK = (s) => /[\u4e00-\u9fa5]/.test(s);

/**
 * @param {object} site 归一化后的站点
 * @param {string[]} keywords 关键字表（中文 + 拉丁）
 * @returns {'av'|'tv'}
 */
export function classifySite(site, keywords) {
  const words = Array.isArray(keywords) && keywords.length ? keywords : DEFAULT_ADULT_KEYWORDS;
  const name = typeof site.name === 'string' ? site.name : '';
  const api = typeof site.api === 'string' ? site.api : '';
  const ext = typeof site.ext === 'string' ? site.ext : '';
  // 中文同样要查 api / ext：不少成人源的站点名很普通，关键字藏在接口路径里
  const haystack = `${name} ${api} ${ext}`.toLowerCase();

  for (const raw of words) {
    const token = String(raw || '').trim();
    if (!token) continue;
    if (hasCJK(token)) {
      if (haystack.includes(token.toLowerCase())) return 'av';
    } else if (latinRegex(token).test(haystack)) {
      return 'av';
    }
  }
  return 'tv';
}
