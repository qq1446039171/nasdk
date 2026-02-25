export const TIERS = ["10", "15", "20", "25"];

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function clampNumber(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function normalizeNsdkState(raw) {
  const src = isPlainObject(raw) ? raw : {};

  const freezeSrc = isPlainObject(src.freeze) ? src.freeze : {};
  const freeze = {
    active: Boolean(freezeSrc.active),
    reason: freezeSrc.reason ?? null,
    since: freezeSrc.since ?? null
  };

  let drawdownRound = null;
  if (src.drawdownRound === null || src.drawdownRound === undefined) {
    drawdownRound = null;
  } else if (isPlainObject(src.drawdownRound)) {
    const roundSrc = src.drawdownRound;
    const alertedSrc = isPlainObject(roundSrc.alerted) ? roundSrc.alerted : {};
    const executedSrc = isPlainObject(roundSrc.executed) ? roundSrc.executed : {};
    const alerted = {};
    const executed = {};
    for (const t of TIERS) {
      alerted[t] = Boolean(alertedSrc[t]);
      executed[t] = Boolean(executedSrc[t]);
    }

    drawdownRound = {
      startedAt: roundSrc.startedAt ?? null,
      snapshotReserveCny: clampNumber(roundSrc.snapshotReserveCny, 0),
      table: Array.isArray(roundSrc.table) ? roundSrc.table : [],
      alerted,
      executed
    };
  }

  return {
    lastRunKeys: isPlainObject(src.lastRunKeys) ? src.lastRunKeys : {},
    drawdownRound,
    lastMarket: isPlainObject(src.lastMarket) ? src.lastMarket : null,
    freeze
  };
}

export function validateNsdkStateLocal(state) {
  const errors = [];
  const s = isPlainObject(state) ? state : null;
  if (!s) return { ok: false, errors: ["state 不是对象"] };

  if (!isPlainObject(s.freeze)) errors.push("freeze 缺失或不是对象");
  if (s.drawdownRound !== null && s.drawdownRound !== undefined) {
    if (!isPlainObject(s.drawdownRound)) {
      errors.push("drawdownRound 不是对象或 null");
    } else {
      const r = s.drawdownRound;
      if (!isPlainObject(r.executed)) errors.push("drawdownRound.executed 缺失或不是对象");
      if (!isPlainObject(r.alerted)) errors.push("drawdownRound.alerted 缺失或不是对象");
      for (const t of TIERS) {
        if (typeof r.executed?.[t] !== "boolean") errors.push(`drawdownRound.executed.${t} 不是 boolean`);
        if (typeof r.alerted?.[t] !== "boolean") errors.push(`drawdownRound.alerted.${t} 不是 boolean`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

