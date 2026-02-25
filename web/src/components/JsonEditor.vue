<template>
  <div class="wrap">
    <el-input
      type="textarea"
      :rows="rows"
      :model-value="text"
      @update:model-value="onInput"
      spellcheck="false"
    />
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: null, default: null },
  rows: { type: Number, default: 6 }
});

const emit = defineEmits(["update:modelValue"]);

const text = ref("");
const error = ref("");
const lastSynced = ref("");

function format(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

watch(
  () => props.modelValue,
  (v) => {
    const next = format(v);
    if (!lastSynced.value || text.value === lastSynced.value) {
      text.value = next;
    }
    lastSynced.value = next;
  },
  { immediate: true }
);

function onInput(v) {
  text.value = v;
  error.value = "";
  try {
    const parsed = v.trim() ? JSON.parse(v) : null;
    emit("update:modelValue", parsed);
  } catch (e) {
    error.value = e?.message || "JSON 解析失败";
  }
}
</script>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.err {
  color: #dc2626;
  font-size: 12px;
}
</style>

