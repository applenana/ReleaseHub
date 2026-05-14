<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Apis } from '@/api';

const router = useRouter();
const route = useRoute();

const menu = [
  { to: '/admin/firmwares', label: '固件管理', icon: '📦' },
  { to: '/admin/categories', label: '分类管理', icon: '🗂️' },
  { to: '/admin/channels', label: '通道管理', icon: '📡' },
  { to: '/admin/tags', label: '标签管理', icon: '🏷️' },
  { to: '/admin/tokens', label: 'API 令牌', icon: '🔑' },
];

const currentTitle = computed(() => menu.find(m => route.path.startsWith(m.to))?.label || '管理后台');

async function logout() {
  await Apis.logout();
  router.push('/login');
}
</script>

<template>
  <div class="rh-admin">
    <div class="rh-bg-blob b1" />
    <div class="rh-bg-blob b2" />
    <div class="rh-bg-blob b3" />

    <aside class="rh-sider">
      <div class="rh-brand">
        <RouterLink to="/" class="rh-logo">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </RouterLink>
        <div>
          <div class="rh-brand-title">ReleaseHub</div>
          <div class="rh-brand-sub">管理控制台</div>
        </div>
      </div>

      <nav class="rh-nav">
        <RouterLink
          v-for="m in menu"
          :key="m.to"
          :to="m.to"
          class="rh-nav-item"
          :class="{ active: route.path.startsWith(m.to) }"
        >
          <span class="rh-nav-icon">{{ m.icon }}</span>
          <span>{{ m.label }}</span>
        </RouterLink>
      </nav>

      <button class="rh-logout" @click="logout">
        <span>↗</span>
        <span>退出登录</span>
      </button>
    </aside>

    <main class="rh-content">
      <header class="rh-content-head">
        <h1>{{ currentTitle }}</h1>
        <RouterLink to="/" class="rh-go-home">前台首页 →</RouterLink>
      </header>
      <div class="rh-content-body">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.rh-admin {
  position: relative;
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 50%, #ecfdf5 100%);
  overflow-x: hidden;
}
.rh-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  pointer-events: none;
  z-index: 0;
}
.rh-bg-blob.b1 { width: 380px; height: 380px; top: -100px; left: -80px; background: radial-gradient(circle, #bfdbfe, transparent 70%); }
.rh-bg-blob.b2 { width: 460px; height: 460px; bottom: -180px; right: -160px; background: radial-gradient(circle, #a7f3d0, transparent 70%); }
.rh-bg-blob.b3 { width: 300px; height: 300px; top: 40%; left: 35%; background: radial-gradient(circle, #a5f3fc, transparent 70%); }

/* 侧栏 */
.rh-sider {
  position: relative;
  z-index: 1;
  width: 240px;
  flex-shrink: 0;
  padding: 24px 18px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.rh-brand { display: flex; align-items: center; gap: 12px; }
.rh-logo {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(6, 182, 212, 0.4);
  text-decoration: none;
  flex-shrink: 0;
}
.rh-brand-title {
  font-size: 17px;
  font-weight: 800;
  background: linear-gradient(135deg, #1d4ed8 0%, #06b6d4 60%, #10b981 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.5px;
}
.rh-brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }

.rh-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.rh-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  text-decoration: none;
  transition: all 0.2s;
  position: relative;
}
.rh-nav-item:hover {
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
}
.rh-nav-item.active {
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
  color: white;
  box-shadow: 0 8px 18px rgba(6, 182, 212, 0.3);
}
.rh-nav-icon { font-size: 16px; }

.rh-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(16, 185, 129, 0.25);
  background: rgba(255, 255, 255, 0.6);
  color: #10b981;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.rh-logout:hover {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-color: transparent;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(16, 185, 129, 0.3);
}

/* 主区 */
.rh-content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rh-content-head {
  padding: 22px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(59, 130, 246, 0.08);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.rh-content-head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, #1d4ed8 0%, #06b6d4 60%, #10b981 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.5px;
}
.rh-go-home {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.08);
  transition: all 0.2s;
}
.rh-go-home:hover {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(59, 130, 246, 0.3);
}

.rh-content-body {
  flex: 1;
  padding: 24px 32px 48px;
  overflow: auto;
}

@media (max-width: 720px) {
  .rh-admin { flex-direction: column; }
  .rh-sider { width: auto; border-right: none; border-bottom: 1px solid rgba(255, 255, 255, 0.9); }
  .rh-content-head, .rh-content-body { padding-left: 16px; padding-right: 16px; }
}
</style>
