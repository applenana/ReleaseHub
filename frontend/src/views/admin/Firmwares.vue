<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, useDialog, useMessage } from 'naive-ui';
import { Apis, formatBytes, formatTime, type Firmware } from '@/api';

const router = useRouter();
const dialog = useDialog();
const msg = useMessage();
const items = ref<Firmware[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const keyword = ref('');

async function load() {
  loading.value = true;
  try {
    const r = await Apis.firmwares({
      page: page.value,
      page_size: pageSize.value,
      q: keyword.value || undefined,
    });
    items.value = r.items;
    total.value = r.total;
  } finally {
    loading.value = false;
  }
}

function confirmDelete(fw: Firmware) {
  dialog.warning({
    title: '删除固件',
    content: `确定删除「${fw.title} ${fw.version}」？物理文件不会被删除（可能被其它记录复用）。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await Apis.deleteFirmware(fw.id);
      msg.success('已删除');
      load();
    },
  });
}

async function toggleYank(fw: Firmware) {
  await Apis.updateFirmware(fw.id, { is_yanked: !fw.is_yanked });
  load();
}

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '标题', key: 'title' },
  {
    title: '版本',
    key: 'version',
    render: (r: Firmware) => `${r.version}${r.patch_suffix ? '-' + r.patch_suffix : ''}`,
  },
  { title: '通道', key: 'channel', render: (r: Firmware) => r.channel?.label ?? '-' },
  { title: '大小', key: 'file_size', render: (r: Firmware) => formatBytes(r.file_size) },
  { title: '下载', key: 'download_count' },
  {
    title: '状态',
    key: 'is_yanked',
    render: (r: Firmware) => (r.is_yanked ? '已撤回' : '正常'),
  },
  {
    title: '上传时间',
    key: 'uploaded_at',
    render: (r: Firmware) => formatTime(r.uploaded_at),
  },
  {
    title: '操作',
    key: 'op',
    width: 240,
    render: (r: Firmware) =>
      h('div', { style: 'display: flex; gap: 6px' }, [
        h(
          NButton,
          { size: 'small', onClick: () => router.push(`/admin/firmwares/${r.id}/edit`) },
          { default: () => '编辑' },
        ),
        h(
          NButton,
          { size: 'small', onClick: () => toggleYank(r) },
          { default: () => (r.is_yanked ? '恢复' : '撤回') },
        ),
        h(
          NButton,
          { size: 'small', type: 'error', onClick: () => confirmDelete(r) },
          { default: () => '删除' },
        ),
      ]),
  },
];

onMounted(load);
</script>

<template>
  <n-space justify="end" align="center" style="margin-bottom: 16px">
    <n-space>
      <n-input
        v-model:value="keyword"
        placeholder="搜索"
        clearable
        @keyup.enter="load"
        style="width: 240px"
      />
      <n-button type="primary" @click="router.push('/admin/firmwares/new')">上传新固件</n-button>
    </n-space>
  </n-space>

  <n-spin :show="loading">
    <n-data-table :columns="columns" :data="items" :row-key="(r: Firmware) => r.id" />
    <n-pagination
      v-model:page="page"
      :item-count="total"
      :page-size="pageSize"
      style="margin-top: 16px; justify-content: flex-end"
      @update:page="load"
    />
  </n-spin>
</template>
