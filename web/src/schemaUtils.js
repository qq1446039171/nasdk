function deepGet(obj, key) {
  const parts = key.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function deepSet(obj, key, value) {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

export function buildDefaults(schema) {
  const out = {};
  for (const group of schema.groups || []) {
    for (const field of group.fields || []) {
      deepSet(out, field.key, cloneValue(field.default));
    }
  }
  return out;
}

export function normalizeBySchema(schema, input) {
  const out = buildDefaults(schema);
  if (!input || typeof input !== "object") return out;

  if (input?.allocation && typeof input.allocation === "object") {
    if (input.allocation.boughtTargetPercent === undefined && input.allocation.boughtPercent !== undefined) {
      input.allocation.boughtTargetPercent = input.allocation.boughtPercent;
    }
    if (input.allocation.reserveCashTargetPercent === undefined && input.allocation.reserveCashPercent !== undefined) {
      input.allocation.reserveCashTargetPercent = input.allocation.reserveCashPercent;
    }
  }

  if (input?.portfolio && typeof input.portfolio === "object") {
    const deposit = Number(input?.funds?.depositAmount) || 0;
    const reserveTargetPercent = Number(input?.allocation?.reserveCashTargetPercent) || 0;
    const targetReserve = (deposit * reserveTargetPercent) / 100;

    const hasUsed = input.portfolio.reserveUsedNasdaqCny !== undefined;
    const hasRemaining = input.portfolio.reserveCashNasdaqCny !== undefined;

    let used = hasUsed ? Number(input.portfolio.reserveUsedNasdaqCny) || 0 : 0;
    if (!hasUsed && hasRemaining) {
      const remaining = Number(input.portfolio.reserveCashNasdaqCny) || 0;
      used = Math.max(0, targetReserve - remaining);
    }
    used = Math.max(0, used);

    const remaining = Math.max(0, targetReserve - used);
    input.portfolio.reserveUsedNasdaqCny = used;
    input.portfolio.reserveCashNasdaqCny = remaining;
  }

  for (const group of schema.groups || []) {
    for (const field of group.fields || []) {
      const v = deepGet(input, field.key);
      if (v === undefined) continue;
      deepSet(out, field.key, v);
    }
  }
  return out;
}

export function validateLocal(schema, settings) {
  const fieldErrors = {};
  function addErr(key, msg) {
    fieldErrors[key] = fieldErrors[key] || [];
    fieldErrors[key].push(msg);
  }

  for (const group of schema.groups || []) {
    for (const field of group.fields || []) {
      const rules = field.validation || {};
      const v = deepGet(settings, field.key);

      if (rules.required && (v === null || v === undefined || v === "")) addErr(field.key, "必填");

      if (v === null || v === undefined || v === "") continue;

      if (field.type === "number" || field.type === "integer") {
        if (typeof v !== "number" || Number.isNaN(v)) addErr(field.key, "必须是数字");
        if (field.type === "integer" && !Number.isInteger(v)) addErr(field.key, "必须是整数");
        if (typeof rules.min === "number" && v < rules.min) addErr(field.key, `最小值为 ${rules.min}`);
        if (typeof rules.max === "number" && v > rules.max) addErr(field.key, `最大值为 ${rules.max}`);
      } else if (field.type === "boolean") {
        if (typeof v !== "boolean") addErr(field.key, "必须是布尔值");
      } else if (field.type === "string") {
        if (typeof v !== "string") addErr(field.key, "必须是字符串");
        if (typeof rules.maxLength === "number" && typeof v === "string" && v.length > rules.maxLength) {
          addErr(field.key, `长度不能超过 ${rules.maxLength}`);
        }
        if (Array.isArray(rules.options) && !rules.options.includes(v)) {
          addErr(field.key, `必须是以下值之一：${rules.options.join(", ")}`);
        }
      } else if (field.type === "numberArray") {
        if (!Array.isArray(v)) addErr(field.key, "必须是数字数组");
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item !== "number" || Number.isNaN(item)) {
              addErr(field.key, "数组元素必须都是数字");
              break;
            }
          }
        }
      } else if (field.type === "object") {
        if (typeof v !== "object" || v === null || Array.isArray(v)) addErr(field.key, "必须是对象");
      } else if (field.type === "objectArray") {
        if (!Array.isArray(v)) addErr(field.key, "必须是对象数组");
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item !== "object" || item === null || Array.isArray(item)) {
              addErr(field.key, "数组元素必须都是对象");
              break;
            }
          }
        }
      }
    }
  }

  const deposit = deepGet(settings, "funds.depositAmount");
  const exposureLimitPercent = deepGet(settings, "funds.nasdaqExposureLimitPercent");
  const investedAmount = deepGet(settings, "portfolio.investedNasdaqCny");
  const reserveAmount = deepGet(settings, "portfolio.reserveCashNasdaqCny");
  const maxExposure = (Number(deposit) || 0) * (Number(exposureLimitPercent) || 0) / 100;
  const currentExposure = (Number(investedAmount) || 0) + (Number(reserveAmount) || 0);
  if (Number.isFinite(maxExposure) && maxExposure >= 0 && currentExposure > maxExposure + 1e-6) {
    addErr(
      "portfolio.investedNasdaqCny",
      `当前纳指敞口（已投资+备用金=${currentExposure}）超过上限（${maxExposure}）`
    );
    addErr(
      "portfolio.reserveCashNasdaqCny",
      `当前纳指敞口（已投资+备用金=${currentExposure}）超过上限（${maxExposure}）`
    );
  }

  const pushEnabled = deepGet(settings, "nsdk.pushEnabled");
  const sendKey = deepGet(settings, "nsdk.serverChan.sendKey");
  if (pushEnabled !== false && (!sendKey || typeof sendKey !== "string" || !sendKey.trim())) {
    addErr("nsdk.serverChan.sendKey", "pushEnabled 为 true 时必填");
  }

  const benchmarkProvider = deepGet(settings, "nsdk.benchmark.provider") || "eastmoney";
  if (benchmarkProvider !== "eastmoney" && benchmarkProvider !== "stooq") {
    addErr("nsdk.benchmark.provider", "必须是 eastmoney 或 stooq");
  } else if (benchmarkProvider === "eastmoney") {
    const secid = deepGet(settings, "nsdk.benchmark.secid");
    if (!secid || typeof secid !== "string" || !secid.trim()) addErr("nsdk.benchmark.secid", "provider=eastmoney 时必填");
  } else if (benchmarkProvider === "stooq") {
    const symbol = deepGet(settings, "nsdk.benchmark.symbol");
    if (!symbol || typeof symbol !== "string" || !symbol.trim()) addErr("nsdk.benchmark.symbol", "provider=stooq 时必填");
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

