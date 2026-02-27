export const schema = {
  version: 1,
  groups: [
    {
      id: "funds",
      titleZh: "资金与敞口",
      titleEn: "Funds & Exposure",
      fields: [
        {
          key: "funds.depositAmount",
          nameZh: "当前存款金额",
          nameEn: "Current Deposit Amount",
          description: "用户能手动设置：当前存款金额。",
          type: "number",
          default: 0,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "funds.nasdaqExposureLimitPercent",
          nameZh: "纳指相关敞口上限(%)",
          nameEn: "NASDAQ Exposure Limit (%)",
          description: "纳指相关敞口上限默认 60%，支持手动修改。",
          type: "number",
          default: 60,
          validation: { required: true, min: 0, max: 100 }
        }
      ]
    },
    {
      id: "allocation",
      titleZh: "固定比例拆分",
      titleEn: "Fixed Allocation",
      fields: [
        {
          key: "allocation.fixedAllocationEnabled",
          nameZh: "启用固定比例约束",
          nameEn: "Enable Fixed Allocation Constraint",
          description: "固定比例：40% 已买入纳指资产 + 20% 备用纳指资金（现金）。启用后将强制约束比例关系。",
          type: "boolean",
          default: true,
          validation: { required: true }
        },
        {
          key: "allocation.boughtTargetPercent",
          nameZh: "纳指目标占比(%)",
          nameEn: "Bought Target (%)",
          description: "固定比例默认 40%。用于计算“目标金额”与校验，不代表当前已买入金额。",
          type: "number",
          default: 40,
          validation: { required: true, min: 0, max: 100 }
        },
        {
          key: "allocation.reserveCashTargetPercent",
          nameZh: "备用纳指资金目标占比(%)",
          nameEn: "Reserve Cash Target (%)",
          description: "固定比例默认 20%。用于计算“目标金额”与校验，不代表当前备用金金额。",
          type: "number",
          default: 20,
          validation: { required: true, min: 0, max: 100 }
        }
      ],
      hidden: true
    },
    {
      id: "portfolio",
      titleZh: "投资金额（手动输入）",
      titleEn: "Portfolio Amounts",
      fields: [
        {
          key: "portfolio.investedNasdaqCny",
          nameZh: "纳指已投资金额(元)",
          nameEn: "Invested NASDAQ Amount (CNY)",
          description: "手动维护：当前已买入纳指相关资产的市值/金额。",
          type: "number",
          default: 0,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "portfolio.reserveCashNasdaqCny",
          nameZh: "备用纳指资金余额(元)",
          nameEn: "Reserve Cash Remaining (CNY)",
          description: "自动计算：备用金目标金额 - 已使用额度。",
          type: "number",
          default: 0,
          editable: false,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "portfolio.reserveUsedNasdaqCny",
          nameZh: "纳指备用金已使用额度(元)",
          nameEn: "Reserve Used Amount (CNY)",
          description: "手动维护：从备用金目标中已使用/已投入的额度。",
          type: "number",
          default: 0,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "portfolio.fearOfMissingOut",
          nameZh: "怕踏空标记",
          nameEn: "Fear Of Missing Out",
          description: "手动标记：连续上涨触发怕踏空时打开；NSDK将据此进入冻结状态。",
          type: "boolean",
          default: false,
          validation: { required: true }
        }
      ]
    },
    {
      id: "drawdown",
      titleZh: "回撤与快照机制",
      titleEn: "Drawdown & Snapshot",
      fields: [
        {
          key: "drawdown.levelsPercent",
          nameZh: "回撤档位(%)",
          nameEn: "Drawdown Levels (%)",
          description: "规则：本轮所有 -10/-15/-20/-25 档位都按快照基准计算与执行。",
          type: "numberArray",
          default: [-10, -15, -20, -25],
          validation: { required: true }
        },
        {
          key: "drawdown.executedLevels",
          nameZh: "已执行档位映射",
          nameEn: "Executed Levels Map",
          description: "各回撤档位是否已执行，键为档位(例如 10/15/20/25)，值为 true/false。",
          type: "object",
          default: {},
          validation: { required: true }
        },
        {
          key: "snapshot.triggerLevelPercent",
          nameZh: "快照触发档位(%)",
          nameEn: "Snapshot Trigger Level (%)",
          description: "第一次触发回撤 -10% 的那一天锁定快照基准。",
          type: "number",
          default: -10,
          editable: false,
          validation: { required: true }
        },
        {
          key: "snapshot.baselineReserveAmount",
          nameZh: "快照基准储备金余额",
          nameEn: "Snapshot Baseline Reserve Amount",
          description: "回撤加仓用的是“回撤开始时锁定的基准储备金”，不是当下实时储备金。",
          type: "number",
          default: 0,
          editable: false,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "snapshot.lockedAt",
          nameZh: "快照锁定时间",
          nameEn: "Snapshot Locked At",
          description: "第一次触发回撤档位当天记录并锁死快照基准。",
          type: "string",
          default: "",
          editable: false,
          validation: { required: false, maxLength: 64 }
        },
        {
          key: "snapshot.cycleId",
          nameZh: "回撤周期ID",
          nameEn: "Drawdown Cycle ID",
          description: "用于区分不同回撤周期（建议补充）。",
          type: "string",
          default: "",
          editable: false,
          validation: { required: false, maxLength: 64 }
        }
      ]
    },
    {
      id: "meta",
      titleZh: "状态（只读）",
      titleEn: "Meta (Read-only)",
      fields: [
        {
          key: "meta.configVersion",
          nameZh: "配置版本号",
          nameEn: "Config Version",
          description: "每次保存自动递增。",
          type: "integer",
          default: 1,
          editable: false,
          validation: { required: true, min: 1, max: 1_000_000_000 }
        },
        {
          key: "meta.lastSavedAt",
          nameZh: "最后保存时间",
          nameEn: "Last Saved At",
          description: "每次保存自动更新（ISO 字符串）。",
          type: "string",
          default: "",
          editable: false,
          validation: { required: false, maxLength: 64 }
        }
      ]
    },
    {
      id: "nsdk",
      titleZh: "NSDK 运行配置",
      titleEn: "NSDK Runtime",
      fields: [
        {
          key: "nsdk.fund.code",
          nameZh: "标的代码",
          nameEn: "Fund Code",
          description: "例如 513100。",
          type: "string",
          default: "513100",
          validation: { required: true, maxLength: 32 }
        },
        {
          key: "nsdk.fund.secid",
          nameZh: "东方财富 secid",
          nameEn: "Eastmoney SecID",
          description: "例如 1.513100。",
          type: "string",
          default: "1.513100",
          validation: { required: true, maxLength: 64 }
        },
        {
          key: "nsdk.fund.name",
          nameZh: "标的名称",
          nameEn: "Fund Name",
          description: "用于展示与推送文案。",
          type: "string",
          default: "纳指ETF",
          validation: { required: true, maxLength: 64 }
        },
        {
          key: "nsdk.benchmark.provider",
          nameZh: "回撤基准来源",
          nameEn: "Benchmark Provider",
          description: "eastmoney=用基金净值；stooq=用指数/美股ETF（日线）。",
          type: "string",
          default: "eastmoney",
          validation: { required: true, options: ["eastmoney", "stooq"] }
        },
        {
          key: "nsdk.benchmark.secid",
          nameZh: "回撤基准 Eastmoney secid",
          nameEn: "Benchmark Eastmoney SecID",
          description: "provider=eastmoney 时使用，例如 1.513100。",
          type: "string",
          default: "1.513100",
          validation: { required: false, maxLength: 64 }
        },
        {
          key: "nsdk.benchmark.symbol",
          nameZh: "回撤基准 Stooq Symbol",
          nameEn: "Benchmark Stooq Symbol",
          description: "provider=stooq 时使用，例如 QQQ / QQQ.US / IXIC。",
          type: "string",
          default: "QQQ",
          validation: { required: false, maxLength: 64 }
        },
        {
          key: "nsdk.benchmark.name",
          nameZh: "回撤基准名称",
          nameEn: "Benchmark Name",
          description: "用于展示与推送文案，例如 纳指指数（IXIC）。",
          type: "string",
          default: "纳指指数（IXIC）",
          validation: { required: false, maxLength: 64 }
        },
        {
          key: "nsdk.timezone",
          nameZh: "时区",
          nameEn: "Timezone",
          description: "建议保持 Asia/Shanghai。",
          type: "string",
          default: "Asia/Shanghai",
          validation: { required: true, maxLength: 64 }
        },
        {
          key: "nsdk.logDir",
          nameZh: "日志目录",
          nameEn: "Log Directory",
          description: "例如 D:/log-nsdk。",
          type: "string",
          default: "D:/log-nsdk",
          validation: { required: false, maxLength: 256 }
        },
        {
          key: "nsdk.pushEnabled",
          nameZh: "启用推送",
          nameEn: "Push Enabled",
          description: "关闭后不推送（仍会运行与写日志）。",
          type: "boolean",
          default: true,
          validation: { required: true }
        },
        {
          key: "nsdk.serverChan.sendKey",
          nameZh: "Server酱 SendKey",
          nameEn: "ServerChan SendKey",
          description: "pushEnabled 为 true 时必填。",
          type: "string",
          default: "",
          props: { type: "password", showPassword: true },
          validation: { required: false, maxLength: 128 }
        },
        {
          key: "nsdk.startupHeartbeatEnabled",
          nameZh: "启动心跳",
          nameEn: "Startup Heartbeat",
          description: "启动后每日只推送一次心跳。",
          type: "boolean",
          default: true,
          validation: { required: true }
        },
        {
          key: "nsdk.otcDcaCnyPerWorkday",
          nameZh: "每日定投(工作日/元)",
          nameEn: "OTC DCA per Workday",
          description: "工作日的固定小额定投金额。",
          type: "number",
          default: 120,
          validation: { required: true, min: 0, max: 1_000_000_000 }
        },
        {
          key: "nsdk.weeklyActiveBuy",
          nameZh: "每周主动建仓（JSON）",
          nameEn: "Weekly Active Buy (JSON)",
          description: "可填 null 关闭；或填对象配置星期/时间/金额区间。",
          type: "object",
          default: {
            weekday: "Fri",
            hour: "10",
            minute: "00",
            minCny: 5000,
            maxCny: 7000
          },
          validation: { required: false }
        },
        {
          key: "nsdk.dailyChecks",
          nameZh: "每日例行检查时间点（JSON）",
          nameEn: "Daily Checks (JSON)",
          description: "数组：[{hour:'10',minute:'30'},{hour:'14',minute:'30'}]。",
          type: "objectArray",
          default: [
            { hour: "10", minute: "30" },
            { hour: "14", minute: "30" }
          ],
          validation: { required: true }
        }
      ]
    }
  ]
};

