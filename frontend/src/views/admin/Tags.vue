<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { Apis, type Tag } from '@/api';

const msg = useMessage();
const items = ref<Tag[]>([]);
const show = ref(false);
const editing = ref<Partial<Tag>>({});

async function load() {
  items.value = await Apis.tags();
}

function openNew() {
  editing.value = { name: '', color: '#52c41a', description: '' };
  show.value = true;
}
function openEdit(t: Tag) {
  editing.value = { ...t };
  show.value = true;
}

async function submit() {
  try {
    if (editing.value.id) await Apis.updateTag(editing.value.id, editing.value);
    else await Apis.createTag(editing.value);
    msg.success('已保存');
    show.value = false;
    load();
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '失败');
  }
}

async function del(t: Tag) {
  if (!confirm(`删除标签「${t.name}」？`)) return;
  await Apis.deleteTag(t.id);
  msg.success('已删除');
  load();
}

onMounted(load);
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 16px">
    <div></div>
    <n-button type="primary" @click="openNew">新增标签</n-button>
  </n-space>
  <n-space>
    <n-tag
      v-for="t in items"
      :key="t.id"
      :color="{ color: t.color, textColor: '#fff' }"
      closable
      @close="del(t)"
      @click="openEdit(t)"
      style="cursor: pointer"
    >
      {{ t.name }}
    </n-tag>
  </n-space>

  <n-modal v-model:show="show" preset="card" :title="editing.id ? '编辑标签' : '新增标签'" style="width: 420px">
    <n-form label-placement="top">
      <n-form-item label="名称" required>
        <n-input v-model:value="editing.name as any" />
      </n-form-item>
      <n-form-item label="颜色">
        <n-color-picker v-model:value="editing.color as any" />
      </n-form-item>
      <n-form-item label="描述">
        <n-input v-model:value="editing.description as any" type="textarea" />
      </n-form-item>
      <n-button type="primary" block @click="submit">保存</n-button>
    </n-form>
  </n-modal>
</template>
