/**
 * FRED VIX 恐慌指数（近7日）
 *
 * 数据源：美联储经济数据 https://fred.stlouisfed.org/series/VIXCLS
 * 完全免费，无需 Key，直接 GET CSV 即可。
 *
 * 返回格式与 eastmoney/stooq/finnhub 统一：
 * { vix: [{ date: 'YYYY-MM-DD', close: 30.61 }, ...] }
 * 最多返回最近 7 条记录（不足则返回全部可用数据）。
 */

const getJson = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/csv,text/plain,*/*',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
};

const parseNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
};

const getLast7Days = () => {
  const days = [];
  const now = new Date();
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

/**
 * 获取最近7个交易日的 VIX 收盘数据。
 * @returns {Promise<Array<{date: string, close: number}>>}
 */
const getVixLast7 = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    return d.toISOString().slice(0, 10);
  })();

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS&vintage_date=${today}&cosd=${startDate}&coed=${today}`;
  const text = await getJson(url);

  const lines = String(text).split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) throw new Error('Empty VIX data');

  // Skip header line
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const date = String(cols[0]).trim();
    const close = parseNumber(cols[1]);
    if (date && close !== null) {
      rows.push({ date, close });
    }
  }

  // 取最近 7 条（已按日期升序）
  return rows.slice(-7);
};

module.exports = { getVixLast7 };
