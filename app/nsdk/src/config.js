const fs = require('fs');
const path = require('path');

const clampNumber = (v, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const normalizeLevels = (levels) => {
  if (!Array.isArray(levels)) return null;
  const list = levels
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.abs(v))
    .filter((v) => v > 0);
  if (!list.length) return null;
  const uniq = Array.from(new Set(list));
  uniq.sort((a, b) => a - b);
  return uniq.length ? uniq : null;
};

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const resolveSettingsPath = () => {
  if (process.env.SETTINGS_PATH) return path.resolve(process.env.SETTINGS_PATH);

  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const candidate = path.join(repoRoot, 'Config', 'settings.json');
  if (fs.existsSync(candidate)) return candidate;

  const cwdCandidate = path.join(process.cwd(), 'Config', 'settings.json');
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  return candidate;
};

const buildConfigFromSettings = (settings) => {
  const nsdk = settings?.nsdk && typeof settings.nsdk === 'object' ? settings.nsdk : null;
  if (!nsdk) throw new Error('settings.json missing nsdk');

  const depositAmount = clampNumber(settings?.funds?.depositAmount, 0);
  const exposureLimitPercent = clampNumber(settings?.funds?.nasdaqExposureLimitPercent, 60);
  const boughtTargetPercent = clampNumber(settings?.allocation?.boughtTargetPercent, 40);
  const reserveTargetPercent = clampNumber(settings?.allocation?.reserveCashTargetPercent, 20);

  const reserveTargetCny = (depositAmount * reserveTargetPercent) / 100;
  const reserveRemainingFromSettings = clampNumber(settings?.portfolio?.reserveCashNasdaqCny, NaN);
  const reserveUsedFromSettings = clampNumber(settings?.portfolio?.reserveUsedNasdaqCny, NaN);
  const reserveUsedCny = Number.isFinite(reserveUsedFromSettings)
    ? Math.max(0, reserveUsedFromSettings)
    : Number.isFinite(reserveRemainingFromSettings)
      ? Math.max(0, reserveTargetCny - reserveRemainingFromSettings)
      : 0;
  const reserveCashNasdaqCny = Math.max(0, reserveTargetCny - reserveUsedCny);

  const rawBenchmark = nsdk.benchmark && typeof nsdk.benchmark === 'object' ? nsdk.benchmark : null;
  const benchmarkProvider = rawBenchmark?.provider || 'eastmoney';
  const benchmark = {
    provider: benchmarkProvider,
    secid: benchmarkProvider === 'eastmoney' ? (rawBenchmark?.secid || nsdk?.fund?.secid) : (rawBenchmark?.secid || null),
    symbol: benchmarkProvider === 'stooq' ? (rawBenchmark?.symbol || null) : (rawBenchmark?.symbol || null),
    name: rawBenchmark?.name || null,
  };
  if (benchmark.provider === 'eastmoney' && !benchmark.name) {
    benchmark.name = nsdk?.fund?.name ? `${nsdk.fund.name}（净值）` : null;
  }
  if (benchmark.provider === 'stooq' && !benchmark.name) {
    const s = String(benchmark.symbol || '').trim().toUpperCase();
    if (s === 'QQQ' || s === 'QQQ.US') benchmark.name = 'QQQ';
    else if (s === 'IXIC' || s === '^IXIC' || s === '^NDQ') benchmark.name = '纳指指数（IXIC）';
    else if (s === 'NDX' || s === '^NDX') benchmark.name = '纳指100（NDX）';
    else if (s) benchmark.name = s;
    else benchmark.name = null;
  }

  const drawdownLevels = normalizeLevels(settings?.drawdown?.levelsPercent) || [10, 15, 20, 25];

  const cfg = {
    fund: nsdk.fund,
    benchmark,
    timezone: nsdk.timezone,
    logDir: nsdk.logDir,
    pushEnabled: nsdk.pushEnabled !== false,
    startupHeartbeatEnabled: nsdk.startupHeartbeatEnabled !== false,
    serverChan: nsdk.serverChan,
    dailyChecks: nsdk.dailyChecks || [],
    weeklyActiveBuy: nsdk.weeklyActiveBuy || null,
    otcDcaCnyPerWorkday: nsdk.otcDcaCnyPerWorkday,
    baseTotalAssetsCny: Math.round(depositAmount),
    maxNasdaqExposureRatio: exposureLimitPercent / 100,
    activeMaxInvestRatio: boughtTargetPercent / 100,
    reserveRatio: reserveTargetPercent / 100,
    drawdownLevels,
    portfolio: {
      investedNasdaqCny: Math.round(clampNumber(settings?.portfolio?.investedNasdaqCny, 0)),
      reserveCashNasdaqCny: Math.round(reserveCashNasdaqCny),
      reserveUsedNasdaqCny: Math.round(reserveUsedCny),
      fearOfMissingOut: Boolean(settings?.portfolio?.fearOfMissingOut ?? false)
    }
  };

  return cfg;
};

const loadConfig = () => {
  const settingsPath = resolveSettingsPath();
  const settings = readJsonIfExists(settingsPath);
  const cfg = buildConfigFromSettings(settings);

  if (!cfg?.fund?.secid) throw new Error('settings.json missing nsdk.fund.secid');
  if (!cfg?.timezone) throw new Error('settings.json missing nsdk.timezone');
  if (!cfg?.portfolio) throw new Error('settings.json missing portfolio');
  if (!cfg?.benchmark?.provider) throw new Error('settings.json missing nsdk.benchmark.provider');
  if (cfg.benchmark.provider === 'eastmoney' && !cfg.benchmark.secid) throw new Error('settings.json missing nsdk.benchmark.secid');
  if (cfg.benchmark.provider === 'stooq' && !cfg.benchmark.symbol) throw new Error('settings.json missing nsdk.benchmark.symbol');
  if (cfg.pushEnabled) {
    const sendKey = cfg?.serverChan?.sendKey;
    if (!sendKey) throw new Error('settings.json missing nsdk.serverChan.sendKey');
  }

  return cfg;
};

module.exports = {
  loadConfig,
};
