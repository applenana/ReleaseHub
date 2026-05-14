<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Apis,
  formatBytes,
  formatTime,
  type Category,
  type CategoryNode,
  type Channel,
  type Firmware,
  type Tag,
} from '@/api';

const router = useRouter();

const categories = ref<{ flat: Category[]; tree: CategoryNode[] }>({ flat: [], tree: [] });
const channels = ref<Channel[]>([]);
const tags = ref<Tag[]>([]);

const selectedCategoryIds = ref<number[]>([]);
const selectedChannelIds = ref<number[]>([]);
const selectedTagIds = ref<number[]>([]);
const keyword = ref('');
const tagMatchAll = ref(false);
const categoryMatchAll = ref(false);

const firmwares = ref<Firmware[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

const categoryMap = computed(() => {
  const m = new Map<number, Category>();
  for (const c of categories.value.flat) m.set(c.id, c);
  return m;
});

function fullPath(path: string | undefined, leafId?: number): string[] {
  if (!path) return leafId != null ? [categoryMap.value.get(leafId)?.name ?? ''] : [];
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => categoryMap.value.get(Number(s))?.name ?? `#${s}`);
}

const categoryTreeData = computed(() => {
  function map(n: CategoryNode): any {
    return {
      key: n.id,
      label: n.name,
      children: n.children.length ? n.children.map(map) : undefined,
    };
  }
  return categories.value.tree.map(map);
});

// 取某节点的所有祖先 id（不含自身）
function ancestorsOf(id: number): number[] {
  const c = categoryMap.value.get(id);
  if (!c?.path) return [];
  return c.path
    .split('/')
    .filter(Boolean)
    .map(Number)
    .filter((n) => n !== id);
}

// 取某节点的所有后代 id（不含自身）
function descendantsOf(id: number): number[] {
  const out: number[] = [];
  const marker = `/${id}/`;
  for (const c of categories.value.flat) {
    if (c.id !== id && c.path && c.path.includes(marker)) out.push(c.id);
  }
  return out;
}

// 分类勾选：祖先与后代互斥，兄弟可共存
function onCategoryChecked(newKeys: number[]) {
  const prev = new Set(selectedCategoryIds.value);
  const added = newKeys.filter((k) => !prev.has(k));
  const result = new Set(newKeys);
  for (const id of added) {
    for (const a of ancestorsOf(id)) result.delete(a);
    for (const d of descendantsOf(id)) result.delete(d);
  }
  selectedCategoryIds.value = [...result];
}

async function loadMeta() {
  const [c, ch, t] = await Promise.all([Apis.categories(), Apis.channels(), Apis.tags()]);
  categories.value = c;
  channels.value = ch;
  tags.value = t;
}

let reqSeq = 0;
async function loadFirmwares() {
  const my = ++reqSeq;
  loading.value = true;
  try {
    const r = await Apis.firmwares({
      category_ids: selectedCategoryIds.value.join(',') || undefined,
      category_match: categoryMatchAll.value ? 'all' : 'any',
      channel_ids: selectedChannelIds.value.join(',') || undefined,
      tag_ids: selectedTagIds.value.join(',') || undefined,
      tag_match: tagMatchAll.value ? 'all' : 'any',
      q: keyword.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    });
    if (my !== reqSeq) return; // 丢弃过期请求
    firmwares.value = r.items;
    total.value = r.total;
  } finally {
    if (my === reqSeq) loading.value = false;
  }
}

function reset() {
  selectedCategoryIds.value = [];
  selectedChannelIds.value = [];
  selectedTagIds.value = [];
  keyword.value = '';
  page.value = 1;
}

// 防抖：关键字 300ms，其他筛选立即
let kwTimer: number | undefined;
watch(keyword, () => {
  if (kwTimer) window.clearTimeout(kwTimer);
  kwTimer = window.setTimeout(() => {
    page.value = 1;
    loadFirmwares();
  }, 300);
});

watch(
  [selectedCategoryIds, selectedChannelIds, selectedTagIds, tagMatchAll, categoryMatchAll],
  () => {
    page.value = 1;
    loadFirmwares();
  },
  { deep: true },
);

watch(page, () => loadFirmwares());

onMounted(async () => {
  await loadMeta();
  await loadFirmwares();
});
</script>

<template>
  <div class="rh-root">
    <div class="rh-bg-blob rh-blob-1" />
    <div class="rh-bg-blob rh-blob-2" />
    <div class="rh-bg-blob rh-blob-3" />

    <header class="rh-header">
      <div class="rh-brand">
        <div class="rh-logo">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 L3 7 v10 l9 5 9-5 V7 Z" />
            <path d="M3 7 12 12 21 7" />
            <path d="M12 12 V22" />
          </svg>
        </div>
        <div>
          <div class="rh-title">ReleaseHub</div>
          <div class="rh-subtitle">
            热成像固件分发中心
            <span class="rh-subtitle-sep">·</span>
            <span class="rh-subtitle-count"><strong>{{ total }}</strong> 个固件</span>
            <span v-if="loading" class="rh-loading-tag">加载中…</span>
          </div>
        </div>
      </div>
      <div class="rh-spacer" />
      <button class="rh-admin-btn" @click="router.push('/admin')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 22 a8 8 0 0 1 16 0" />
        </svg>
        管理后台
      </button>
    </header>

    <div class="rh-body">
      <aside class="rh-side">
        <section class="rh-side-card">
          <div class="rh-side-label">
            <span class="rh-emoji">🔍</span>
            <span>关键字</span>
            <span v-if="loading" class="rh-mini-spinner" />
          </div>
          <input
            v-model="keyword"
            class="rh-search"
            placeholder="标题 / 版本 / 文件名"
          />
        </section>

        <section class="rh-side-card">
          <div class="rh-side-label">
            <span class="rh-emoji">📁</span>
            <span>分类</span>
            <label class="rh-match">
              <input type="checkbox" v-model="categoryMatchAll" />
              <span>全部满足</span>
            </label>
          </div>
          <div class="rh-tree-wrap">
            <n-tree
              :data="categoryTreeData"
              checkable
              :cascade="false"
              expand-on-click
              :default-expand-all="true"
              :checked-keys="selectedCategoryIds"
              @update:checked-keys="onCategoryChecked"
              block-line
            />
          </div>
        </section>

        <section class="rh-side-card">
          <div class="rh-side-label">
            <span class="rh-emoji">🚦</span>
            <span>通道</span>
          </div>
          <div class="rh-chips">
            <label
              v-for="ch in channels"
              :key="ch.id"
              class="rh-chip"
              :class="{ active: selectedChannelIds.includes(ch.id) }"
              :style="selectedChannelIds.includes(ch.id) ? { background: ch.color, borderColor: ch.color, color: '#fff' } : {}"
            >
              <input
                type="checkbox"
                :value="ch.id"
                v-model="selectedChannelIds"
                hidden
              />
              <span class="rh-chip-dot" :style="{ background: ch.color }" />
              {{ ch.label }}
            </label>
          </div>
        </section>

        <section class="rh-side-card">
          <div class="rh-side-label">
            <span class="rh-emoji">🏷️</span>
            <span>标签</span>
            <label class="rh-match">
              <input type="checkbox" v-model="tagMatchAll" />
              <span>全部满足</span>
            </label>
          </div>
          <div class="rh-chips">
            <label
              v-for="t in tags"
              :key="t.id"
              class="rh-chip"
              :class="{ active: selectedTagIds.includes(t.id) }"
              :style="selectedTagIds.includes(t.id) ? { background: t.color, borderColor: t.color, color: '#fff' } : {}"
            >
              <input
                type="checkbox"
                :value="t.id"
                v-model="selectedTagIds"
                hidden
              />
              {{ t.name }}
            </label>
          </div>
        </section>

        <button class="rh-reset" @click="reset">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12 a9 9 0 1 0 3-6.7" />
            <path d="M3 3 v6 h6" />
          </svg>
          重置筛选
        </button>
      </aside>

      <main class="rh-main">
        <div v-if="!firmwares.length && !loading" class="rh-empty">
          <div class="rh-empty-icon">📦</div>
          <div class="rh-empty-title">没有匹配的固件</div>
          <div class="rh-empty-sub">尝试调整筛选条件或点击「重置筛选」</div>
        </div>

        <transition-group name="rh-card" tag="div" class="rh-cards">
          <article
            v-for="fw in firmwares"
            :key="fw.id"
            class="rh-card"
            :style="{ '--channel-color': fw.channel?.color ?? '#3b82f6' }"
            @click="router.push(`/firmwares/${fw.id}`)"
          >
            <div class="rh-card-row">
              <div class="rh-card-main">
                <div class="rh-card-title">
                  <span class="rh-card-name">{{ fw.title }}</span>
                  <span class="rh-pill rh-pill-ver">
                    {{ fw.version }}{{ fw.patch_suffix ? '-' + fw.patch_suffix : '' }}
                  </span>
                  <span
                    v-if="fw.channel"
                    class="rh-pill"
                    :style="{ background: fw.channel.color }"
                  >
                    {{ fw.channel.label }}
                  </span>
                  <span
                    v-for="t in fw.tags"
                    :key="t.id"
                    class="rh-pill rh-pill-tag"
                    :style="{ background: t.color }"
                  >
                    {{ t.name }}
                  </span>
                </div>

                <div class="rh-card-meta">
                  <span class="rh-meta-item">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    {{ formatBytes(fw.file_size) }}
                  </span>
                  <span class="rh-meta-item">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12c0 5-9 9-9 9s-9-4-9-9a9 9 0 0 1 18 0z" /></svg>
                    {{ fw.download_count }} 次下载
                  </span>
                  <span class="rh-meta-item">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    {{ formatTime(fw.uploaded_at) }}
                  </span>
                </div>

                <div v-if="fw.categories.length" class="rh-card-paths">
                  <div v-for="c in fw.categories" :key="c.id" class="rh-path">
                    <template v-for="(seg, i) in fullPath(c.path, c.id)" :key="i">
                      <span class="rh-path-seg">{{ seg }}</span>
                      <span v-if="i < fullPath(c.path, c.id).length - 1" class="rh-path-sep">›</span>
                    </template>
                  </div>
                </div>
              </div>

              <a
                :href="Apis.downloadUrl(fw.id)"
                class="rh-dl-btn"
                @click.stop
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                下载
              </a>
            </div>
          </article>
        </transition-group>

        <n-pagination
          v-if="total > pageSize"
          v-model:page="page"
          :item-count="total"
          :page-size="pageSize"
          style="margin-top: 32px; justify-content: center"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.rh-root {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7ff 0%, #fef3ff 50%, #f0fcff 100%);
  overflow-x: hidden;
}

/* 背景模糊渐变球 */
.rh-bg-blob {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
}
.rh-blob-1 {
  width: 480px;
  height: 480px;
  top: -160px;
  left: -120px;
  background: radial-gradient(circle, #bfdbfe 0%, transparent 70%);
}
.rh-blob-2 {
  width: 520px;
  height: 520px;
  top: 30%;
  right: -180px;
  background: radial-gradient(circle, #a7f3d0 0%, transparent 70%);
}
.rh-blob-3 {
  width: 420px;
  height: 420px;
  bottom: -120px;
  left: 30%;
  background: radial-gradient(circle, #67e8f9 0%, transparent 70%);
  opacity: 0.4;
}

/* 顶栏 */
.rh-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 72px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
}
.rh-spacer { flex: 1; }
.rh-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.rh-logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 55%, #10b981 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.rh-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.2px;
  background: linear-gradient(120deg, #0c4a6e, #3b82f6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.1;
}
.rh-subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
}
.rh-admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.25);
  background: rgba(255, 255, 255, 0.6);
  color: #4338ca;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.rh-admin-btn:hover {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  color: #fff;
  border-color: transparent;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
}

/* 主区 */
.rh-body {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(260px, 300px) 1fr;
  gap: 20px;
  padding: 20px 24px 48px;
  max-width: 1480px;
  margin: 0 auto;
}

/* 侧栏 */
.rh-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rh-side-card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  padding: 18px 20px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}
.rh-side-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12px;
}
.rh-emoji { font-size: 15px; }
.rh-match {
  margin-left: auto;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.rh-match input { accent-color: #3b82f6; }

.rh-search {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(59, 130, 246, 0.12);
  background: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  color: #1e293b;
  outline: none;
  transition: all 0.2s ease;
}
.rh-search:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}
.rh-search::placeholder { color: #94a3b8; }

.rh-tree-wrap {
  margin: 0 -6px;
}
:deep(.n-tree-node-content__text) {
  font-size: 13.5px;
}

.rh-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rh-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid rgba(59, 130, 246, 0.15);
  background: rgba(255, 255, 255, 0.7);
  font-size: 12.5px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  user-select: none;
  transition: all 0.18s ease;
}
.rh-chip:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06); }
.rh-chip.active { box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15); }
.rh-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.rh-chip.active .rh-chip-dot { background: rgba(255, 255, 255, 0.85) !important; }

.rh-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}
.rh-reset:hover {
  background: #fff;
  color: #1e293b;
  transform: translateY(-1px);
}

/* hero 副标题计数 */
.rh-subtitle-sep {
  margin: 0 6px;
  color: #cbd5e1;
}
.rh-subtitle-count strong {
  font-weight: 700;
  font-size: 14px;
  background: linear-gradient(120deg, #3b82f6, #06b6d4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-right: 2px;
}
.rh-loading-tag {
  margin-left: 10px;
  font-size: 11px;
  color: #3b82f6;
  font-weight: 500;
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.rh-mini-spinner {
  margin-left: auto;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(59, 130, 246, 0.25);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 卡片 */
.rh-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rh-card {
  position: relative;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-left: 4px solid var(--channel-color, #3b82f6);
  border-radius: 20px;
  padding: 20px 24px 20px 24px;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.rh-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.04));
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.rh-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
}
.rh-card:hover::before { opacity: 1; }

.rh-card-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 20px;
}
.rh-card-main { flex: 1; min-width: 0; }
.rh-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rh-card-name {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  margin-right: 4px;
  letter-spacing: 0.1px;
}

.rh-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.2px;
  line-height: 1.6;
}
.rh-pill-ver {
  background: linear-gradient(135deg, #3b82f6, #818cf8);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}
.rh-pill-tag { opacity: 0.92; }

.rh-card-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
}
.rh-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.rh-card-paths {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rh-path {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.08));
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 999px;
  font-size: 12px;
  width: fit-content;
  max-width: 100%;
}
.rh-path-seg {
  color: #4338ca;
  font-weight: 600;
}
.rh-path-sep {
  color: #06b6d4;
  font-weight: 700;
  margin: 0 2px;
}

.rh-dl-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.rh-dl-btn:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.45);
}
.rh-dl-btn:active { transform: translateY(0); }

/* 入场 / 过渡动画 */
.rh-card-enter-active,
.rh-card-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.rh-card-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.rh-card-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
.rh-card-move {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 空态 */
.rh-empty {
  margin-top: 80px;
  text-align: center;
  color: #64748b;
}
.rh-empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
  animation: float 4s ease-in-out infinite;
}
.rh-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}
.rh-empty-sub { font-size: 13.5px; }

/* 响应式 */
@media (max-width: 600px) {
  .rh-body { grid-template-columns: 1fr; padding: 16px; }
  .rh-header { padding: 0 16px; }
}
</style>
