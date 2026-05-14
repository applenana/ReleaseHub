<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { Apis, type Channel } from '@/api';

const msg = useMessage();
const items = ref<Channel[]>([]);
const show = ref(false);
const editing = ref<Partial<Channel>>({});

async function load() {
  items.value = await Apis.channels();
}

function openNew() {
  editing.value = { key: '', label: '', color: '#1890ff', description: '', sort_order: 0 };
  show.value = true;
}
function openEdit(c: Channel) {
  editing.value = { ...c };
  show.value = true;
}

async function submit() {
  try {
    if (editing.value.id) {
      await Apis.updateChannel(editing.value.id, editing.value);
    } else {
      await Apis.createChannel(editing.value);
    }
    msg.success('已保存');
    show.value = false;
    load();
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '失败');
  }
}

async function del(c: Channel) {
  if (!confirm(`删除通道「${c.label}」？`)) return;
  try {
    await Apis.deleteChannel(c.id);
    msg.success('已删除');
    load();
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '失败');
  }
}

onMounted(load);
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 16px">
    <div></div>
    <n-button type="primary" @click="openNew">新增通道</n-button>
  </n-space>
  <n-list bordered>
    <n-list-item v-for="c in items" :key="c.id">
      <n-space align="center">
        <n-tag :color="{ color: c.color, textColor: '#fff' }">{{ c.label }}</n-tag>
        <n-text code>{{ c.key }}</n-text>
        <n-text depth="3">{{ c.description }}</n-text>
      </n-space>
      <template #suffix>
        <n-space>
          <n-button size="small" @click="openEdit(c)">编辑</n-button>
          <n-button size="small" type="error" @click="del(c)">删除</n-button>
        </n-space>
      </template>
    </n-list-item>
  </n-list>

  <n-modal v-model:show="show" preset="card" :title="editing.id ? '编辑通道' : '新增通道'" style="width: 480px">
    <n-form label-placement="top">
      <n-form-item label="key（唯一标识，仅创建时可编辑）" required>
        <n-input v-model:value="editing.key as any" :disabled="!!editing.id" />
      </n-form-item>
      <n-form-item label="显示名称" required>
        <n-input v-model:value="editing.label as any" />
      </n-form-item>
      <n-form-item label="颜色">
        <n-color-picker v-model:value="editing.color as any" />
      </n-form-item>
      <n-form-item label="描述">
        <n-input v-model:value="editing.description as any" type="textarea" />
      </n-form-item>
      <n-form-item label="排序">
        <n-input-number v-model:value="editing.sort_order as any" />
      </n-form-item>
      <n-button type="primary" block @click="submit">保存</n-button>
    </n-form>
  </n-modal>
</template>
