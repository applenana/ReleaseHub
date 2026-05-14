<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import { Apis, formatBytes, formatTime, type Category, type Firmware } from '@/api';

const route = useRoute();
const router = useRouter();
const fw = ref<Firmware | null>(null);
const loading = ref(true);
const allCategories = ref<Category[]>([]);

const categoryMap = computed(() => {
  const m = new Map<number, Category>();
  for (const c of allCategories.value) m.set(c.id, c);
  return m;
});

function fullPath(path: string | undefined, leafId?: number): string[] {
  if (!path) return leafId != null ? [categoryMap.value.get(leafId)?.name ?? ''] : [];
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => categoryMap.value.get(Number(s))?.name ?? `#${s}`);
}

onMounted(async () => {
  try {
    const [f, cs] = await Promise.all([
      Apis.firmware(parseInt(route.params.id as string, 10)),
      Apis.categories(),
    ]);
    fw.value = f;
    allCategories.value = cs.flat;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <n-layout class="rh-detail-root">
    <n-layout-header bordered class="rh-detail-header">
      <n-button quaternary round @click="router.push('/')">← 返回</n-button>
    </n-layout-header>
    <n-layout-content content-style="padding: 32px; max-width: 980px; margin: 0 auto">
      <n-spin :show="loading">
        <n-empty v-if="!fw && !loading" description="固件不存在" />
        <div v-if="fw">
          <n-h1 style="margin-bottom: 12px">{{ fw.title }}</n-h1>
          <n-space style="margin-bottom: 20px">
            <n-tag round type="info">
              {{ fw.version }}{{ fw.patch_suffix ? '-' + fw.patch_suffix : '' }}
            </n-tag>
            <n-tag v-if="fw.channel" round :color="{ color: fw.channel.color, textColor: '#fff' }">
              {{ fw.channel.label }}
            </n-tag>
            <n-tag
              v-for="t in fw.tags"
              :key="t.id"
              round
              :color="{ color: t.color, textColor: '#fff' }"
            >
              {{ t.name }}
            </n-tag>
          </n-space>

          <n-card class="rh-detail-card" :bordered="false">
            <n-descriptions :column="2" size="small" label-placement="left">
              <n-descriptions-item label="文件名">{{ fw.original_filename }}</n-descriptions-item>
              <n-descriptions-item label="大小">{{ formatBytes(fw.file_size) }}</n-descriptions-item>
              <n-descriptions-item label="SHA256" :span="2">
                <n-text code style="word-break: break-all">{{ fw.file_sha256 }}</n-text>
              </n-descriptions-item>
              <n-descriptions-item label="上传时间">{{ formatTime(fw.uploaded_at) }}</n-descriptions-item>
              <n-descriptions-item label="下载次数">{{ fw.download_count }}</n-descriptions-item>
              <n-descriptions-item label="分类" :span="2">
                <div class="rh-detail-paths">
                  <div v-for="c in fw.categories" :key="c.id" class="rh-path">
                    <template v-for="(seg, i) in fullPath(c.path, c.id)" :key="i">
                      <span class="rh-path-seg">{{ seg }}</span>
                      <span v-if="i < fullPath(c.path, c.id).length - 1" class="rh-path-sep">›</span>
                    </template>
                  </div>
                </div>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-button
            type="primary"
            size="large"
            round
            tag="a"
            :href="Apis.downloadUrl(fw.id)"
            style="margin-top: 20px"
          >
            下载固件
          </n-button>

          <n-divider />
          <n-h3>更新日志</n-h3>
          <md-preview :model-value="fw.changelog || '_暂无更新日志_'" />
        </div>
      </n-spin>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.rh-detail-root {
  min-height: 100vh;
  background: linear-gradient(180deg, #f6f8fc 0%, #eef2f8 100%);
}
.rh-detail-header {
  padding: 14px 28px;
  background: rgba(255, 255, 255, 0.78) !important;
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
}
.rh-detail-card {
  background: rgba(255, 255, 255, 0.85) !important;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}
.rh-detail-paths {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rh-path {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(91, 141, 239, 0.08);
  border-radius: 999px;
  font-size: 12px;
  width: fit-content;
}
.rh-path-seg {
  color: #4a5568;
  font-weight: 500;
}
.rh-path-sep {
  color: #94a3b8;
}
</style>
