<template>
  <el-input
    v-model="text"
    :disabled="disabled"
    placeholder="-10,-15,-20,-25"
    @blur="commit"
    @keyup.enter="commit"
  />
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(["update:modelValue"]);

const text = ref("");

const normalized = computed(() =>
  (props.modelValue || []).map((x) => (typeof x === "number" ? x : Number(x))).filter((x) => Number.isFinite(x))
);

function syncFromModel() {
  text.value = normalized.value.join(",");
}

function commit() {
  const parts = String(text.value || "")
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nums = parts.map((s) => Number(s)).filter((n) => Number.isFinite(n));
  emit("update:modelValue", nums);
  syncFromModel();
}

watch(
  () => props.modelValue,
  () => syncFromModel(),
  { immediate: true, deep: true }
);
</script>

