<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { NButton, useMessage } from 'naive-ui';
import { Apis, formatTime } from '@/api';

const msg = useMessage();
const items = ref<any[]>([]);
const showNew = ref(false);
const newName = ref('');
const newScope = ref<'read' | 'write'>('write');
const createdToken = ref<string | null>(null);

async function load() {
  items.value = await Apis.tokens();
}

async function create() {
  if (!newName.value) return msg.warning('请填写名称');
  const r = await Apis.createToken(newName.value, newScope.value);
  createdToken.value = r.token;
  newName.value = '';
  showNew.value = false;
  load();
}

async function revoke(id: number) {
  if (!confirm('撤销后该 Token 立即失效，不可恢复，确定？')) return;
  await Apis.revokeToken(id);
  msg.success('已撤销');
  load();
}

function copyToken() {
  if (!createdToken.value) return;
  navigator.clipboard.writeText(createdToken.value);
  msg.success('已复制');
}

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name' },
  { title: '前缀', key: 'token_prefix' },
  { title: '权限', key: 'scope' },
  { title: '创建时间', key: 'created_at', render: (r: any) => formatTime(r.created_at) },
  {
    title: '最后使用',
    key: 'last_used_at',
    render: (r: any) => (r.last_used_at ? formatTime(r.last_used_at) : '从未'),
  },
  { title: '状态', key: 'revoked', render: (r: any) => (r.revoked ? '已撤销' : '有效') },
  {
    title: '操作',
    key: 'op',
    render: (r: any) =>
      r.revoked
        ? ''
        : h(NButton, { size: 'small', type: 'error', onClick: () => revoke(r.id) }, () => '撤销'),
  },
];

onMounted(load);
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 16px">
    <div></div>
    <n-button type="primary" @click="showNew = true">新建 Token</n-button>
  </n-space>

  <n-alert
    v-if="createdToken"
    type="success"
    closable
    style="margin-bottom: 16px"
    @close="createdToken = null"
  >
    <template #header>Token 已生成（仅此一次显示，请妥善保管）</template>
    <n-input-group>
      <n-input :value="createdToken" readonly />
      <n-button @click="copyToken">复制</n-button>
    </n-input-group>
  </n-alert>

  <n-data-table :columns="columns" :data="items" />

  <n-modal v-model:show="showNew" preset="card" title="新建 API Token" style="width: 420px">
    <n-form label-placement="top">
      <n-form-item label="名称" required>
        <n-input v-model:value="newName" placeholder="例如：CI 上传脚本" />
      </n-form-item>
      <n-form-item label="权限">
        <n-radio-group v-model:value="newScope">
          <n-radio value="write">读写</n-radio>
          <n-radio value="read">仅读</n-radio>
        </n-radio-group>
      </n-form-item>
      <n-button type="primary" block @click="create">创建</n-button>
    </n-form>
  </n-modal>
</template>
