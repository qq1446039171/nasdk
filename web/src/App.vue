<template>
  <div class="page">
    <header class="header">
      <div class="title">NSDK 参数配置</div>
      <div class="status">
        <el-tag v-if="fileStatus === 'none'" type="info">未选择文件</el-tag>
        <el-tag v-else-if="fileStatus === 'loaded'" type="success">已打开文件</el-tag>
        <el-tag v-else-if="fileStatus === 'saved'" type="success">已保存</el-tag>
        <el-tag v-else-if="fileStatus === 'error'" type="danger">文件错误</el-tag>
        <el-tag v-if="nasdaqExposureOverLimit" type="danger">纳指敞口超限</el-tag>
        <el-tag v-if="dirty" type="warning">未保存</el-tag>
        <el-tag v-if="!localValidation.ok" type="danger">存在校验错误</el-tag>
      </div>
    </header>

    <main class="content">
      <el-alert v-if="fileMessage" :type="fileMessageType" :closable="false" :title="fileMessage" show-icon style="margin-bottom: 12px" />

      <el-card v-if="schema" shadow="never" style="margin-bottom: 12px">
        <template #header>
          <div class="cardHeader">
            <div class="cardTitle">操作</div>
            <div class="meta">
              <span>配置版本：{{ settings?.meta?.configVersion ?? "-" }}</span>
              <span>最后保存：{{ settings?.meta?.lastSavedAt || "-" }}</span>
              <span>文件：{{ fileName || "-" }}</span>
            </div>
          </div>
        </template>

        <div class="actions">
          <el-button @click="openFile">打开文件</el-button>
          <el-button type="primary" :disabled="!canSave" @click="saveToFile">保存</el-button>
          <el-button :disabled="!settings" @click="saveAs">另存为</el-button>
          <el-button :disabled="!dirty" @click="resetToLoaded">重置</el-button>
          <el-button type="danger" @click="resetDefaults">恢复默认</el-button>
          <el-button @click="exportJson">导出</el-button>
          <el-button type="success" :disabled="!settings" @click="openGithubSaveDialog">保存到 GitHub</el-button>
          <el-upload :show-file-list="false" :auto-upload="false" accept="application/json" :on-change="onImportFile">
            <el-button>导入</el-button>
          </el-upload>
          <el-button @click="openVersions">版本/对比</el-button>
          <el-button @click="clearSnapshot">清空快照</el-button>
        </div>

        <el-alert
          v-if="saveMessage"
          :type="saveMessageType"
          :closable="false"
          :title="saveMessage"
          show-icon
          style="margin-top: 12px"
        />

      </el-card>

      <el-card v-if="schema" shadow="never" style="margin-bottom: 12px">
        <template #header>
          <div class="cardHeader">
            <div class="cardTitle">运行时状态（state.json）</div>
            <div class="meta">
              <span>文件：{{ stateFileName || "-" }}</span>
              <span>状态：{{ stateFileStatusLabel }}</span>
              <span v-if="nsdkStateDirty">未保存</span>
              <span v-if="!stateLocalValidation.ok">存在校验错误</span>
            </div>
          </div>
        </template>

        <div class="actions">
          <el-button @click="openStateFile">打开 state.json</el-button>
          <el-button type="primary" :disabled="!canSaveState" @click="saveStateToFile">保存 state.json</el-button>
          <el-button :disabled="!nsdkState" @click="saveStateAs">另存为</el-button>
          <el-button :disabled="!nsdkStateDirty" @click="resetStateToLoaded">重置</el-button>
        </div>

        <el-alert
          v-if="stateMessage"
          :type="stateMessageType"
          :closable="false"
          :title="stateMessage"
          show-icon
          style="margin-top: 12px"
        />

        <div v-if="nsdkState" class="stateGrid">
          <div class="stateBlock">
            <div class="stateBlockTitle">冻结（freeze）</div>
            <div class="stateLine">active：{{ nsdkState.freeze?.active ? "true" : "false" }}</div>
            <div class="stateLine">reason：{{ nsdkState.freeze?.reason ?? "-" }}</div>
            <div class="stateLine">since：{{ nsdkState.freeze?.since ?? "-" }}</div>
          </div>

          <div class="stateBlock">
            <div class="stateBlockTitle">最近行情（lastMarket）</div>
            <div class="stateLine">code：{{ nsdkState.lastMarket?.benchmark?.code ?? "-" }} · {{ nsdkState.lastMarket?.benchmark?.name ?? "-" }}</div>
            <div class="stateLine">price：{{ nsdkState.lastMarket?.benchmark?.price ?? "-" }} · pct：{{ nsdkState.lastMarket?.benchmark?.pct ?? "-" }}</div>
            <div class="stateLine">drawdownPct：{{ nsdkState.lastMarket?.benchmark?.drawdownPct ?? "-" }} · at：{{ nsdkState.lastMarket?.at ?? "-" }}</div>
          </div>
        </div>

        <div v-if="nsdkState" style="margin-top: 12px">
          <el-alert
            v-if="!nsdkState.drawdownRound"
            type="info"
            :closable="false"
            title="当前未启动 drawdownRound（到 -10% 时由 NSDK 自动创建）"
            show-icon
          />

          <div v-else class="stateBlock">
            <div class="stateBlockTitle">本轮回撤（drawdownRound）</div>
            <div class="stateLine">startedAt：{{ nsdkState.drawdownRound.startedAt ?? "-" }}</div>
            <div class="stateLine">snapshotReserveCny：¥{{ fmtMoney(nsdkState.drawdownRound.snapshotReserveCny) }}</div>

            <el-table :data="drawdownTierRows" style="width: 100%; margin-top: 10px" size="small">
              <el-table-column prop="tier" label="档位" width="90" />
              <el-table-column prop="amountCny" label="买入金额(¥)" min-width="140">
                <template #default="{ row }">¥{{ fmtMoney(row.amountCny) }}</template>
              </el-table-column>
              <el-table-column prop="alerted" label="已提醒" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.alerted ? 'warning' : 'info'">{{ row.alerted ? "是" : "否" }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="已执行" width="120">
                <template #default="{ row }">
                  <el-switch :model-value="row.executed" @update:model-value="(v) => setTierExecuted(row.tier, v)" />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-card>

      <el-card v-if="settings" shadow="never" style="margin-bottom: 12px">
        <template #header>
          <div class="cardHeader">
            <div class="cardTitle">资产概览</div>
            <div class="cardActions">
              <el-button size="small" type="primary" :disabled="!settings" @click="openAdjustDialog">新增金额</el-button>
            </div>
          </div>
        </template>
        <div class="dashboard">
          <div class="chart-container" ref="chartRef"></div>
          <div class="stats-container">
            <el-statistic title="当前存款总金额" :value="depositAmount" :precision="2" prefix="¥" />
            <div v-if="hasLatestMarket" class="marketLine">
              推送标的：{{ latestBenchmarkName }} ｜ 当前价格：{{ latestBenchmarkPriceText }} ｜ 回撤幅度：-{{ latestDrawdownText }}%
            </div>
            <div class="stat-row">
              <el-statistic title="纳指已投资金额" :value="nasdaqInvestedAmount" :precision="2" prefix="¥">
                <template #suffix>
                  <span class="pct">
                    ({{ fmtPercent(nasdaqInvestedPercent) }}%)
                    · 还能投资 {{ fmtPercent(remainingInvestPercent) }}% / ¥{{ fmtMoney(remainingInvestAmount) }}
                  </span>
                </template>
              </el-statistic>
            </div>
            <div class="stat-row">
              <el-statistic title="备用金纳指金额" :value="nasdaqReserveCashAmount" :precision="2" prefix="¥">
                <template #suffix>
                  <span class="pct">
                    · 已使用额度 {{ fmtPercent(reserveUsedPercentOfTarget) }}% / ¥{{ fmtMoney(reserveUsedAmount) }}
                  </span>
                </template>
              </el-statistic>
            </div>
            <div class="stat-row">
              <el-statistic title="纳指备用金使用额度" :value="reserveUsedAmount" :precision="2" prefix="¥">
                <template #suffix>
                  <span class="pct">(占备用金目标 {{ fmtPercent(reserveUsedPercentOfTarget) }}%)</span>
                </template>
              </el-statistic>
            </div>
          </div>
        </div>
      </el-card>

      <el-dialog v-model="githubSaveOpen" title="保存到 GitHub 仓库" width="620px" :close-on-click-modal="false">
        <div class="adjustGrid">
          <div class="adjustItem">
            <div class="adjustLabel">Repo Owner</div>
            <el-input v-model="githubRepoOwner" placeholder="例如: your-name" />
          </div>
          <div class="adjustItem">
            <div class="adjustLabel">Repo Name</div>
            <el-input v-model="githubRepoName" placeholder="例如: nasdk" />
          </div>
          <div class="adjustItem">
            <div class="adjustLabel">Target Branch</div>
            <el-input v-model="githubBranch" placeholder="main" />
          </div>
          <div class="adjustItem">
            <div class="adjustLabel">GitHub Personal Access Token</div>
            <el-input v-model="githubToken" type="password" show-password placeholder="需要 workflow 权限" />
          </div>
          <div class="adjustItem" style="grid-column: 1 / -1">
            <div class="adjustLabel">Commit Message</div>
            <el-input v-model="githubCommitMessage" placeholder="chore(config): update settings from web" />
          </div>
        </div>
        <el-alert
          type="info"
          :closable="false"
          title="此操作会调用 GitHub Actions workflow_dispatch，把当前 settings.json 写入仓库 Config/settings.json。"
          show-icon
          style="margin-top: 10px"
        />
        <template #footer>
          <el-button @click="githubSaveOpen = false">取消</el-button>
          <el-button type="primary" :loading="githubSaving" :disabled="!canDispatchGithubSave" @click="dispatchGithubSave">提交到仓库</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="adjustOpen" title="新增金额" width="520px" :close-on-click-modal="false">
        <div class="adjustGrid">
          <div class="adjustItem">
            <div class="adjustLabel">新增总金额</div>
            <el-input-number v-model="addDepositDelta" :min="0" :step="1000" :precision="2" controls-position="right" style="width: 100%" />
            <div class="adjustHint">当前：¥{{ fmtMoney(depositAmount) }} · 新值：¥{{ fmtMoney(previewDepositAmount) }}</div>
          </div>
          <div class="adjustItem">
            <div class="adjustLabel">新增纳指投资金额</div>
            <el-input-number
              v-model="addNasdaqInvestDelta"
              :min="0"
              :step="1000"
              :precision="2"
              controls-position="right"
              style="width: 100%"
            />
            <div class="adjustHint">当前：¥{{ fmtMoney(nasdaqInvestedAmount) }} · 新值：¥{{ fmtMoney(previewNasdaqInvestedAmount) }}</div>
          </div>
        </div>
        <template #footer>
          <el-button @click="adjustOpen = false">取消</el-button>
          <el-button type="primary" :disabled="!canApplyAdjust" @click="applyAdjust">确定</el-button>
        </template>
      </el-dialog>

      <el-collapse v-if="schema && settings" v-model="openedGroups">
        <el-collapse-item v-for="group in visibleGroups" :key="group.id" :name="group.id">
          <template #title>
            <div class="groupTitle">
              <span>{{ group.titleZh }}</span>
              <span class="sub">({{ group.titleEn }})</span>
            </div>
          </template>

          <div class="groupGrid">
            <div v-for="field in group.fields" :key="field.key" class="field">
              <div class="fieldHeader">
                <div class="fieldName">
                  <span class="zh">{{ field.nameZh }}</span>
                  <span class="en">{{ field.nameEn }}</span>
                </div>
                <div class="fieldKey">{{ field.key }}</div>
              </div>

              <div class="fieldControl">
                <component
                  :is="resolveComponent(field)"
                  :model-value="deepGet(settings, field.key)"
                  @update:model-value="(v) => deepSet(settings, field.key, v)"
                  :disabled="field.editable === false"
                  v-bind="field.props || {}"
                />
              </div>

              <div class="fieldDesc">{{ field.description }}</div>

              <div v-if="localValidation.fieldErrors?.[field.key]?.length" class="fieldErrors">
                <el-tag v-for="(e, idx) in localValidation.fieldErrors[field.key]" :key="idx" type="danger">
                  {{ e }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <el-card v-if="showExecutedLevelsCard" shadow="never" style="margin-top: 12px; margin-bottom: 12px">
        <template #header>
          <div class="cardHeader">
            <div class="cardTitle">回撤档位执行状态（Config/settings.json）</div>
            <div class="meta">
              <span>仅在触发回撤档位后显示，用于控制 levelsPercent 各档位是否已执行</span>
            </div>
          </div>
        </template>

        <el-table :data="settingsDrawdownRows" style="width: 100%" size="small">
          <el-table-column prop="tier" label="档位" width="100">
            <template #default="{ row }">-{{ row.tier }}%</template>
          </el-table-column>
          <el-table-column prop="executed" label="已执行" width="140">
            <template #default="{ row }">
              <el-switch :model-value="row.executed" @update:model-value="(v) => setTierExecuted(row.tier, v)" />
            </template>
          </el-table-column>
        </el-table>
      </el-card>


      <el-drawer v-model="versionsOpen" title="版本 / 对比 / 操作日志" size="60%">
        <div class="drawerSection">
          <div class="drawerTitle">版本列表</div>
          <el-table :data="versions" height="220">
            <el-table-column prop="id" label="版本ID" min-width="220" />
            <el-table-column prop="savedAt" label="时间" min-width="220" />
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button size="small" @click="compareWith(row.id)">对比当前</el-button>
                <el-button size="small" type="primary" @click="rollbackTo(row.id)">回滚</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="drawerSection">
          <div class="drawerTitle">差异</div>
          <el-table :data="diffChanges" height="260">
            <el-table-column prop="key" label="字段" min-width="220" />
            <el-table-column label="from" min-width="180">
              <template #default="{ row }">
                <pre class="jsonCell">{{ formatJson(row.from) }}</pre>
              </template>
            </el-table-column>
            <el-table-column label="to" min-width="180">
              <template #default="{ row }">
                <pre class="jsonCell">{{ formatJson(row.to) }}</pre>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="drawerSection">
          <div class="drawerTitle">操作日志</div>
          <el-table :data="logs" height="240">
            <el-table-column prop="at" label="时间" min-width="220" />
            <el-table-column prop="action" label="动作" width="120" />
            <el-table-column prop="ok" label="成功" width="80" />
            <el-table-column prop="bytes" label="大小(bytes)" width="120" />
            <el-table-column prop="reason" label="原因" min-width="140" />
          </el-table>
        </div>
      </el-drawer>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { ElMessageBox } from "element-plus";
import * as echarts from "echarts";

import { normalizeBySchema, validateLocal } from "./schemaUtils";
import { normalizeNsdkState, validateNsdkStateLocal } from "./nsdkStateUtils";
import NumberArrayInput from "./components/NumberArrayInput.vue";
import JsonEditor from "./components/JsonEditor.vue";
import { schema as embeddedSchema } from "./schema";

const schema = ref(null);
const settings = ref(null);
const loadedSettings = ref(null);
const fileHandle = ref(null);
const fileName = ref("");
const fileStatus = ref("none");
const fileMessage = ref("");
const fileMessageType = ref("info");

const saveMessage = ref("");
const saveMessageType = ref("success");


const stateFileHandle = ref(null);
const stateFileName = ref("");
const stateFileStatus = ref("none");
const stateMessage = ref("");
const stateMessageType = ref("info");
const nsdkState = ref(null);
const loadedNsdkState = ref(null);

const openedGroups = ref([]);

const versionsOpen = ref(false);
const versions = ref([]);
const logs = ref([]);
const diffChanges = ref([]);
const chartRef = ref(null);
let myChart = null;

const adjustOpen = ref(false);
const addDepositDelta = ref(0);
const addNasdaqInvestDelta = ref(0);

const githubSaveOpen = ref(false);
const githubSaving = ref(false);
const githubRepoOwner = ref("");
const githubRepoName = ref("");
const githubBranch = ref("main");
const githubToken = ref("");
const githubCommitMessage = ref("chore(config): update settings from web");

function nowIso() {
  return new Date().toISOString();
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

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

function resolveComponent(field) {
  if (field.type === "boolean") return "el-switch";
  if (field.type === "number" || field.type === "integer") return "el-input-number";
  if (field.type === "numberArray") return NumberArrayInput;
  if (field.type === "object" || field.type === "objectArray") return JsonEditor;
  return "el-input";
}

function formatJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const moneyFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return moneyFormatter.format(n);
}

function fmtPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

const latestBenchmark = computed(() => nsdkState.value?.lastMarket?.benchmark || null);
const hasLatestMarket = computed(() => Boolean(latestBenchmark.value));
const latestBenchmarkName = computed(() => latestBenchmark.value?.name || latestBenchmark.value?.code || "-");
const latestBenchmarkPriceText = computed(() => {
  const n = Number(latestBenchmark.value?.price);
  return Number.isFinite(n) ? fmtMoney(n) : "-";
});
const latestDrawdownText = computed(() => {
  const n = Number(latestBenchmark.value?.drawdownPct);
  return Number.isFinite(n) ? fmtPercent(n) : "-";
});

const depositAmount = computed(() => Number(settings.value?.funds?.depositAmount) || 0);
const nasdaqInvestedAmount = computed(() => Number(settings.value?.portfolio?.investedNasdaqCny) || 0);
const nasdaqReserveCashAmount = computed(() => Number(settings.value?.portfolio?.reserveCashNasdaqCny) || 0);
const nasdaqReserveUsedAmount = computed(() => Number(settings.value?.portfolio?.reserveUsedNasdaqCny) || 0);

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

const previewDepositAmount = computed(() => Math.max(0, depositAmount.value + (Number(addDepositDelta.value) || 0)));
const previewNasdaqInvestedAmount = computed(() => {
  const next = Math.max(0, nasdaqInvestedAmount.value + (Number(addNasdaqInvestDelta.value) || 0));
  if (previewDepositAmount.value > 0) return Math.min(next, previewDepositAmount.value);
  return next;
});

const canApplyAdjust = computed(() => (Number(addDepositDelta.value) || 0) > 0 || (Number(addNasdaqInvestDelta.value) || 0) > 0);
const canDispatchGithubSave = computed(() => {
  return Boolean(
    settings.value &&
    githubRepoOwner.value.trim() &&
    githubRepoName.value.trim() &&
    githubBranch.value.trim() &&
    githubToken.value.trim()
  );
});

function openAdjustDialog() {
  addDepositDelta.value = 0;
  addNasdaqInvestDelta.value = 0;
  adjustOpen.value = true;
}

function applyAdjust() {
  if (!settings.value) return;
  deepSet(settings.value, "funds.depositAmount", roundMoney(previewDepositAmount.value));
  deepSet(settings.value, "portfolio.investedNasdaqCny", roundMoney(previewNasdaqInvestedAmount.value));
  adjustOpen.value = false;
}

const exposureLimitPercent = computed(() => Number(settings.value?.funds?.nasdaqExposureLimitPercent) || 0);
const boughtTargetPercent = computed(() => Number(settings.value?.allocation?.boughtTargetPercent) || 0);
const reserveTargetPercent = computed(() => Number(settings.value?.allocation?.reserveCashTargetPercent) || 0);

const nasdaqInvestedPercent = computed(() => {
  if (depositAmount.value <= 0) return 0;
  return Math.round((nasdaqInvestedAmount.value / depositAmount.value) * 10000) / 100;
});
const nasdaqReserveCashPercent = computed(() => {
  if (depositAmount.value <= 0) return 0;
  return Math.round((nasdaqReserveCashAmount.value / depositAmount.value) * 10000) / 100;
});

const targetInvestAmount = computed(() => (depositAmount.value * boughtTargetPercent.value) / 100);
const remainingInvestAmount = computed(() => Math.max(0, targetInvestAmount.value - nasdaqInvestedAmount.value));
const remainingInvestPercent = computed(() => {
  if (depositAmount.value <= 0) return 0;
  return Math.round((remainingInvestAmount.value / depositAmount.value) * 10000) / 100;
});

const targetReserveAmount = computed(() => (depositAmount.value * reserveTargetPercent.value) / 100);
const reserveUsedAmount = computed(() => Math.max(0, nasdaqReserveUsedAmount.value));
const reserveUsedPercentOfTarget = computed(() => {
  if (targetReserveAmount.value <= 0) return 0;
  return Math.round((reserveUsedAmount.value / targetReserveAmount.value) * 10000) / 100;
});

const reserveCashAuto = computed(() => {
  return Math.max(0, targetReserveAmount.value - reserveUsedAmount.value);
});

const maxExposureAmount = computed(() => (depositAmount.value * exposureLimitPercent.value) / 100);
const currentExposureAmount = computed(() => nasdaqInvestedAmount.value + nasdaqReserveCashAmount.value);
const remainingExposureAmount = computed(() => Math.max(0, maxExposureAmount.value - currentExposureAmount.value));
const remainingExposurePercent = computed(() => {
  if (depositAmount.value <= 0) return 0;
  return Math.round((remainingExposureAmount.value / depositAmount.value) * 10000) / 100;
});
const nasdaqExposureOverLimit = computed(() => {
  return currentExposureAmount.value > maxExposureAmount.value + 1e-6;
});

function updateChart() {
  if (!chartRef.value) return;
  if (!myChart) myChart = echarts.init(chartRef.value);

  const invested = nasdaqInvestedAmount.value;
  const total = depositAmount.value;
  const other = total > 0 ? total - invested : 0;

  if (total <= 0) {
    myChart.setOption({
      animation: false,
      title: { text: "暂无资金数据", left: "center", top: "center", textStyle: { color: "#999" } },
      series: []
    });
    return;
  }

  const option = {
    animation: false,
    title: {
      show: false
    },
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)"
    },
    legend: {
      orient: "horizontal",
      left: "center",
      top: 8,
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
      textStyle: {
        fontSize: 12
      }
    },
    series: [
      {
        name: "资金分布",
        type: "pie",
        center: ["50%", "62%"],
        radius: ["48%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2
        },
        label: {
          show: false,
          position: "center"
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: "bold"
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: invested, name: "纳指", itemStyle: { color: "#409EFF" } },
          { value: other > 0 ? other : 0, name: "其他", itemStyle: { color: "#E6A23C" } }
        ]
      }
    ]
  };
  myChart.setOption(option);
}

watch(
  [depositAmount, nasdaqInvestedAmount, nasdaqReserveCashAmount, reserveUsedAmount, reserveTargetPercent],
  () => {
    if (settings.value) {
      const current = Number(settings.value?.portfolio?.reserveCashNasdaqCny) || 0;
      const next = Math.round(reserveCashAuto.value * 100) / 100;
      if (Math.abs(current - next) > 1e-6) {
        deepSet(settings.value, "portfolio.reserveCashNasdaqCny", next);
      }
    }
    nextTick(() => updateChart());
  },
  { immediate: true }
);

watch(settings, () => {
  nextTick(() => updateChart());
});

onMounted(async () => {
  window.addEventListener("resize", () => myChart?.resize());
  const state = loadState();
  const prefs = state.githubPrefs || {};
  githubRepoOwner.value = prefs.owner || "";
  githubRepoName.value = prefs.repo || "";
  githubBranch.value = prefs.branch || "main";
  githubCommitMessage.value = prefs.commitMessage || "chore(config): update settings from web";
  await tryAutoLoadSettings();
});

const localValidation = computed(() => {
  if (!schema.value || !settings.value) return { ok: true, fieldErrors: {} };
  return validateLocal(schema.value, settings.value);
});

const stateLocalValidation = computed(() => {
  if (!nsdkState.value) return { ok: true, errors: [] };
  return validateNsdkStateLocal(nsdkState.value);
});

const dirty = computed(() => {
  if (!settings.value || !loadedSettings.value) return false;
  return JSON.stringify(settings.value) !== JSON.stringify(loadedSettings.value);
});

const nsdkStateDirty = computed(() => {
  if (!nsdkState.value || !loadedNsdkState.value) return false;
  return JSON.stringify(nsdkState.value) !== JSON.stringify(loadedNsdkState.value);
});

const canSave = computed(() => dirty.value && localValidation.value.ok);


const canSaveState = computed(() => nsdkStateDirty.value && stateLocalValidation.value.ok);

const visibleGroups = computed(() => {
  const groups = schema.value?.groups || [];
  return groups.filter((g) => g && g.hidden !== true);
});

const showExecutedLevelsCard = computed(() => {
  if (!settings.value) return false;
  return Boolean(nsdkState.value?.drawdownRound);
});

const stateFileStatusLabel = computed(() => {
  if (stateFileStatus.value === "none") return "未选择文件";
  if (stateFileStatus.value === "loaded") return "已打开";
  if (stateFileStatus.value === "saved") return "已保存";
  if (stateFileStatus.value === "error") return "错误";
  return String(stateFileStatus.value);
});

function loadDefaults() {
  schema.value = embeddedSchema;
  openedGroups.value = (schema.value.groups || []).filter((g) => g && g.hidden !== true).map((g) => g.id);
  settings.value = normalizeBySchema(schema.value, {});
  loadedSettings.value = cloneValue(settings.value);
}

async function tryAutoLoadSettings() {
  const candidates = [];
  const owner = githubRepoOwner.value.trim();
  const repo = githubRepoName.value.trim();
  const branch = githubBranch.value.trim() || "main";

  if (owner && repo) {
    candidates.push({
      source: "github-raw",
      name: `Config/settings.json @ ${owner}/${repo}#${branch}`,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/Config/settings.json?ts=${Date.now()}`
    });
  }

  candidates.push(
    { source: "local-static", name: "Config/settings.json（同源静态文件）", url: "./Config/settings.json" },
    { source: "local-static", name: "Config/settings.json（根路径）", url: "/Config/settings.json" }
  );

  for (const c of candidates) {
    try {
      const res = await fetch(c.url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      const json = JSON.parse(text);
      settings.value = normalizeBySchema(schema.value, json);
      loadedSettings.value = cloneValue(settings.value);
      fileStatus.value = "loaded";
      fileName.value = c.name;
      fileMessageType.value = "success";
      fileMessage.value = `已自动加载：${c.name}`;
      await addVersionSnapshot(`autoLoad:${c.source}`);
      await addLog({ action: "autoLoad", ok: true, reason: c.url, bytes: text.length });
      return true;
    } catch {
      // continue trying next source
    }
  }

  await addLog({ action: "autoLoad", ok: false, reason: "no_available_source", bytes: 0 });
  return false;
}

async function openFile() {
  fileMessage.value = "";
  try {
    const picker = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const h = picker?.[0];
    if (!h) return;
    fileHandle.value = h;
    fileName.value = h.name || "";

    const file = await h.getFile();
    const text = await file.text();
    const json = JSON.parse(text);

    settings.value = normalizeBySchema(schema.value, json);
    loadedSettings.value = cloneValue(settings.value);
    fileStatus.value = "loaded";
    fileMessageType.value = "success";
    fileMessage.value = "文件加载成功";
    await addVersionSnapshot("openFile");
    await addLog({ action: "open", ok: true, reason: "", bytes: text.length });
  } catch (e) {
    fileStatus.value = "error";
    fileMessageType.value = "error";
    fileMessage.value = `打开失败：${e?.message || String(e)}`;
    await addLog({ action: "open", ok: false, reason: fileMessage.value, bytes: 0 });
  }
}

async function openStateFile() {
  stateMessage.value = "";
  try {
    const picker = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const h = picker?.[0];
    if (!h) return;
    stateFileHandle.value = h;
    stateFileName.value = h.name || "";

    const file = await h.getFile();
    const text = await file.text();
    const json = JSON.parse(text);

    nsdkState.value = normalizeNsdkState(json);
    loadedNsdkState.value = cloneValue(nsdkState.value);
    stateFileStatus.value = "loaded";
    stateMessageType.value = "success";
    stateMessage.value = "state.json 加载成功";
    await addLog({ action: "stateOpen", ok: true, reason: "", bytes: text.length });
  } catch (e) {
    stateFileStatus.value = "error";
    stateMessageType.value = "error";
    stateMessage.value = `打开 state.json 失败：${e?.message || String(e)}`;
    await addLog({ action: "stateOpen", ok: false, reason: stateMessage.value, bytes: 0 });
  }
}

async function saveStateToFile() {
  if (!stateFileHandle.value) {
    stateMessageType.value = "warning";
    stateMessage.value = "未选择 state.json：请先点击“打开 state.json”";
    return;
  }
  try {
    await ElMessageBox.confirm("将覆盖写入本地 state.json 文件，确认保存？", "确认保存", {
      confirmButtonText: "保存",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  try {
    const raw = JSON.stringify(nsdkState.value, null, 2);
    await writeToHandle(stateFileHandle.value, raw);
    nsdkState.value = normalizeNsdkState(nsdkState.value);
    loadedNsdkState.value = cloneValue(nsdkState.value);
    stateFileStatus.value = "saved";
    stateMessageType.value = "success";
    stateMessage.value = "state.json 保存成功";
    await addLog({ action: "stateSave", ok: true, reason: "", bytes: raw.length });
  } catch (e) {
    stateFileStatus.value = "error";
    stateMessageType.value = "error";
    stateMessage.value = `保存 state.json 失败：${e?.message || String(e)}`;
    await addLog({ action: "stateSave", ok: false, reason: stateMessage.value, bytes: 0 });
  }
}

async function saveStateAs() {
  try {
    const h = await window.showSaveFilePicker({
      suggestedName: "state.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    stateFileHandle.value = h;
    stateFileName.value = h.name || "state.json";
    await saveStateToFile();
  } catch (e) {
    stateMessageType.value = "warning";
    stateMessage.value = `state.json 另存为已取消：${e?.message || String(e)}`;
  }
}

function resetStateToLoaded() {
  nsdkState.value = cloneValue(loadedNsdkState.value);
  stateMessage.value = "";
}

function getDrawdownLevelsFromSettings() {
  const raw = settings.value?.drawdown?.levelsPercent;
  if (!Array.isArray(raw)) return [10, 15, 20, 25];
  const levels = raw
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.abs(v))
    .filter((v) => v > 0);
  const uniq = Array.from(new Set(levels)).sort((a, b) => a - b);
  return uniq.length ? uniq : [10, 15, 20, 25];
}

function getExecutedLevelsFromSettings() {
  const levels = getDrawdownLevelsFromSettings();
  const src = settings.value?.drawdown?.executedLevels || {};
  const map = {};
  for (const level of levels) {
    map[String(level)] = Boolean(src[String(level)]);
  }
  return map;
}

const settingsDrawdownRows = computed(() => {
  const executedMap = getExecutedLevelsFromSettings();
  return getDrawdownLevelsFromSettings().map((tier) => ({
    tier: String(tier),
    executed: Boolean(executedMap[String(tier)])
  }));
});

const drawdownTierRows = computed(() => {
  const round = nsdkState.value?.drawdownRound;
  if (!round) return [];
  const executedMap = getExecutedLevelsFromSettings();
  const table = Array.isArray(round.table) ? round.table : [];
  return getDrawdownLevelsFromSettings().map((tier) => {
    const row = table.find((x) => String(x?.level) === String(tier));
    return {
      tier: String(tier),
      amountCny: row?.amountCny ?? null,
      alerted: Boolean(round.alerted?.[String(tier)]),
      executed: Boolean(executedMap[String(tier)])
    };
  });
});

function setTierExecuted(tier, value) {
  const next = { ...(settings.value?.drawdown?.executedLevels || {}) };
  next[String(tier)] = Boolean(value);
  deepSet(settings.value, "drawdown.executedLevels", next);
}

async function writeToHandle(handle, jsonText) {
  const writable = await handle.createWritable();
  await writable.write(jsonText);
  await writable.close();
}

async function saveToFile() {
  saveMessage.value = "";
  if (!fileHandle.value) {
    fileMessageType.value = "warning";
    fileMessage.value = "未选择文件：请先点击“打开文件”选择 D:\\TZ-NSDK\\Config\\settings.json";
    return;
  }

  try {
    await ElMessageBox.confirm("将覆盖写入本地 JSON 文件，确认保存？", "确认保存", {
      confirmButtonText: "保存",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  try {
    const next = cloneValue(settings.value);
    const v = Number(next?.meta?.configVersion) || 1;
    next.meta = next.meta || {};
    next.meta.configVersion = dirty.value ? v + 1 : v;
    next.meta.lastSavedAt = nowIso();

    const raw = JSON.stringify(next, null, 2);
    await writeToHandle(fileHandle.value, raw);

    settings.value = normalizeBySchema(schema.value, next);
    loadedSettings.value = cloneValue(settings.value);
    fileStatus.value = "saved";
    fileMessageType.value = "success";
    fileMessage.value = "保存成功";
    saveMessageType.value = "success";
    saveMessage.value = "保存成功";
    await addVersionSnapshot("save");
    await addLog({ action: "save", ok: true, reason: "", bytes: raw.length });
  } catch (e) {
    fileStatus.value = "error";
    fileMessageType.value = "error";
    fileMessage.value = `保存失败：${e?.message || String(e)}`;
    saveMessageType.value = "error";
    saveMessage.value = fileMessage.value;
    await addLog({ action: "save", ok: false, reason: fileMessage.value, bytes: 0 });
  }
}

async function saveAs() {
  saveMessage.value = "";
  try {
    const h = await window.showSaveFilePicker({
      suggestedName: "settings.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    fileHandle.value = h;
    fileName.value = h.name || "settings.json";
    await saveToFile();
  } catch (e) {
    fileMessageType.value = "warning";
    fileMessage.value = `另存为已取消：${e?.message || String(e)}`;
  }
}

function openGithubSaveDialog() {
  githubSaveOpen.value = true;
}

function encodeUtf8Base64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function dispatchGithubSave() {
  if (!settings.value || !canDispatchGithubSave.value) return;
  githubSaving.value = true;
  try {
    const payload = {
      ref: githubBranch.value.trim(),
      inputs: {
        settings_base64: encodeUtf8Base64(JSON.stringify(settings.value)),
        commit_message: githubCommitMessage.value.trim() || "chore(config): update settings from web"
      }
    };
    const url = `https://api.github.com/repos/${githubRepoOwner.value.trim()}/${githubRepoName.value.trim()}/actions/workflows/save-settings.yml/dispatches`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken.value.trim()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text || "dispatch_failed"}`);
    }

    saveMessageType.value = "success";
    saveMessage.value = "已触发保存到仓库 workflow，请在 GitHub Actions 中查看执行结果。";
    githubSaveOpen.value = false;
    await addLog({ action: "githubSaveDispatch", ok: true, reason: "", bytes: JSON.stringify(payload).length });
  } catch (e) {
    saveMessageType.value = "error";
    saveMessage.value = `保存到 GitHub 失败：${e?.message || String(e)}`;
    await addLog({ action: "githubSaveDispatch", ok: false, reason: saveMessage.value, bytes: 0 });
  } finally {
    githubSaving.value = false;
  }
}

function resetToLoaded() {
  settings.value = cloneValue(loadedSettings.value);
  saveMessage.value = "";
}

async function resetDefaults() {
  try {
    await ElMessageBox.confirm("将恢复默认值并覆盖写入本地文件，确认？", "确认恢复默认", {
      confirmButtonText: "恢复",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  settings.value = normalizeBySchema(schema.value, {});
  loadedSettings.value = cloneValue(settings.value);
  saveMessageType.value = "success";
  saveMessage.value = "已恢复默认（尚未写入文件，点击保存后生效）";
  await addLog({ action: "resetDefaults", ok: true, reason: "", bytes: 0 });
}

async function exportJson() {
  const raw = JSON.stringify(settings.value, null, 2);
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.value || "settings.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await addLog({ action: "export", ok: true, reason: "", bytes: raw.length });
}

async function onImportFile(uploadFile) {
  const file = uploadFile?.raw;
  if (!file) return;
  const text = await file.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    saveMessageType.value = "error";
    saveMessage.value = "导入失败：不是合法JSON";
    return;
  }
  settings.value = normalizeBySchema(schema.value, json);
  loadedSettings.value = cloneValue(settings.value);
  saveMessageType.value = "success";
  saveMessage.value = "导入成功（尚未写入文件，点击保存后生效）";
  await addLog({ action: "import", ok: true, reason: "", bytes: text.length });
}

async function clearSnapshot() {
  try {
    await ElMessageBox.confirm("将清空快照基准与锁定信息并保存，确认？", "确认清空快照", {
      confirmButtonText: "清空",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  deepSet(settings.value, "snapshot.baselineReserveAmount", 0);
  deepSet(settings.value, "snapshot.lockedAt", "");
  deepSet(settings.value, "snapshot.cycleId", "");
  saveMessageType.value = "success";
  saveMessage.value = "已清空快照（尚未写入文件，点击保存后生效）";
  await addLog({ action: "clearSnapshot", ok: true, reason: "", bytes: 0 });
}

const STORAGE_KEY = "tz-nsdk-configurator";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { versions: [], logs: [], githubPrefs: {} };
  } catch {
    return { versions: [], logs: [], githubPrefs: {} };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function addVersionSnapshot(reason) {
  const state = loadState();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.versions = state.versions || [];
  state.versions.unshift({ id, savedAt: nowIso(), reason, settings: cloneValue(settings.value) });
  state.versions = state.versions.slice(0, 50);
  saveState(state);
}

async function addLog(entry) {
  const state = loadState();
  state.logs = state.logs || [];
  state.logs.unshift({ at: nowIso(), ...entry });
  state.logs = state.logs.slice(0, 200);
  saveState(state);
}

async function refreshDrawerData() {
  if (!versionsOpen.value) return;
  const state = loadState();
  versions.value = (state.versions || []).map((v) => ({ id: v.id, savedAt: v.savedAt, reason: v.reason }));
  logs.value = state.logs || [];
}

async function openVersions() {
  versionsOpen.value = true;
  diffChanges.value = [];
  await refreshDrawerData();
}

async function compareWith(versionId) {
  const state = loadState();
  const found = (state.versions || []).find((v) => v.id === versionId);
  if (!found) return;
  const from = normalizeBySchema(schema.value, found.settings);
  const to = settings.value;
  const changes = [];
  for (const group of schema.value.groups || []) {
    for (const field of group.fields || []) {
      const a = deepGet(from, field.key);
      const b = deepGet(to, field.key);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        changes.push({ key: field.key, nameZh: field.nameZh, nameEn: field.nameEn, from: a, to: b });
      }
    }
  }
  diffChanges.value = changes;
}

async function rollbackTo(versionId) {
  try {
    await ElMessageBox.confirm("将回滚到该历史版本并覆盖写入本地文件，确认？", "确认回滚", {
      confirmButtonText: "回滚",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  const state = loadState();
  const found = (state.versions || []).find((v) => v.id === versionId);
  if (!found) return;
  settings.value = normalizeBySchema(schema.value, found.settings);
  loadedSettings.value = cloneValue(settings.value);
  saveMessageType.value = "success";
  saveMessage.value = "已回滚到历史版本（点击保存后写入文件）";
  await addLog({ action: "rollback", ok: true, reason: versionId, bytes: 0 });
}

watch([githubRepoOwner, githubRepoName, githubBranch, githubCommitMessage], () => {
  const state = loadState();
  state.githubPrefs = {
    owner: githubRepoOwner.value,
    repo: githubRepoName.value,
    branch: githubBranch.value,
    commitMessage: githubCommitMessage.value
  };
  saveState(state);
});

watch(versionsOpen, async (open) => {
  if (open) await refreshDrawerData();
});

loadDefaults();
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
.status {
  display: flex;
  gap: 12px;
  align-items: center;
}
.content {
  padding: 24px;
  max-width: 1280px;
  margin: 0 auto;
}
.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.cardActions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.cardTitle {
  font-weight: 600;
  font-size: 16px;
  color: #0f172a;
}
.meta {
  display: flex;
  gap: 16px;
  color: #64748b;
  font-size: 13px;
  flex-wrap: wrap;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.stateGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.stateBlock {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}
.stateBlockTitle {
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 6px;
}
.stateLine {
  color: #334155;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;
}
.dashboard {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  padding: 8px 0;
}
.chart-container {
  width: 360px;
  height: 240px;
  flex-shrink: 0;
}
.stats-container {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}
.marketLine {
  grid-column: 1 / -1;
  font-size: 13px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
}
.stat-row {
  display: flex;
  flex-direction: column;
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}
.stat-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e1;
}
.pct {
  font-size: 13px;
  color: #64748b;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.adjustGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.adjustItem {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.adjustLabel {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.adjustHint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}
@media (max-width: 900px) {
  .dashboard {
    flex-direction: column;
    align-items: center;
  }
  .chart-container {
    width: 100%;
    max-width: 400px;
    height: 280px;
  }
  .stats-container {
    width: 100%;
    grid-template-columns: 1fr;
  }
}
.groupTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}
.groupTitle .sub {
  font-weight: 400;
  color: #94a3b8;
  font-size: 13px;
}
.groupGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding-top: 16px;
}
@media (max-width: 900px) {
  .groupGrid {
    grid-template-columns: 1fr;
  }
}
.field {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;
}
.field:hover {
  border-color: #94a3b8;
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.fieldHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}
.fieldName {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fieldName .zh {
  font-weight: 600;
  color: #334155;
}
.fieldName .en {
  font-size: 12px;
  color: #94a3b8;
}
.fieldKey {
  font-size: 12px;
  color: #cbd5e1;
  font-family: monospace;
}
.fieldControl {
  margin-bottom: 12px;
}
.fieldDesc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}
.fieldErrors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.drawerSection {
  margin-bottom: 24px;
}
.drawerTitle {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
  color: #334155;
}
.jsonCell {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  font-family: monospace;
  color: #475569;
}
</style>

