<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useMessage } from 'naive-ui';
import { Apis } from '@/api';

const router = useRouter();
const route = useRoute();
const msg = useMessage();
const username = ref('');
const password = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  try {
    await Apis.login(username.value, password.value);
    const redirect = (route.query.redirect as string) || '/admin';
    router.push(redirect);
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="rh-login">
    <div class="rh-bg-blob b1" />
    <div class="rh-bg-blob b2" />
    <div class="rh-bg-blob b3" />

    <div class="rh-login-card">
      <div class="rh-login-brand">
        <div class="rh-logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div>
          <div class="rh-title">ReleaseHub</div>
          <div class="rh-sub">管理员登录</div>
        </div>
      </div>

      <form class="rh-form" @submit.prevent="submit">
        <label class="rh-field">
          <span>用户名</span>
          <input v-model="username" class="rh-input" autofocus placeholder="请输入用户名" />
        </label>
        <label class="rh-field">
          <span>密码</span>
          <input v-model="password" class="rh-input" type="password" placeholder="请输入密码" @keyup.enter="submit" />
        </label>
        <button type="submit" class="rh-submit" :disabled="loading">
          <span v-if="loading" class="rh-spin" />
          <span>{{ loading ? '登录中…' : '进 入 后 台' }}</span>
        </button>
        <RouterLink to="/" class="rh-back">← 返回首页</RouterLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.rh-login {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 50%, #ecfdf5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.rh-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  pointer-events: none;
  animation: float 8s ease-in-out infinite;
}
.rh-bg-blob.b1 { width: 420px; height: 420px; top: -120px; left: -120px; background: radial-gradient(circle, #bfdbfe, transparent 70%); }
.rh-bg-blob.b2 { width: 460px; height: 460px; bottom: -160px; right: -120px; background: radial-gradient(circle, #a7f3d0, transparent 70%); animation-delay: -3s; }
.rh-bg-blob.b3 { width: 320px; height: 320px; top: 40%; left: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, #a5f3fc, transparent 70%); animation-delay: -5s; }

.rh-login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 36px 32px 28px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 24px 60px rgba(59, 130, 246, 0.18), 0 4px 12px rgba(0, 0, 0, 0.04);
  animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes rise {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: none; }
}

.rh-login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}
.rh-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(6, 182, 212, 0.4);
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.rh-title {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, #1d4ed8 0%, #06b6d4 50%, #10b981 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.5px;
}
.rh-sub { font-size: 13px; color: #6b7280; margin-top: 2px; }

.rh-form { display: flex; flex-direction: column; gap: 16px; }
.rh-field { display: flex; flex-direction: column; gap: 6px; }
.rh-field span { font-size: 13px; font-weight: 600; color: #4b5563; padding-left: 4px; }
.rh-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1.5px solid rgba(59, 130, 246, 0.15);
  background: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  color: #1f2937;
  outline: none;
  transition: all 0.2s;
}
.rh-input:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.rh-submit {
  margin-top: 8px;
  height: 48px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 60%, #10b981 100%);
  color: white;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 10px 24px rgba(6, 182, 212, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
}
.rh-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(6, 182, 212, 0.45);
}
.rh-submit:disabled { opacity: 0.7; cursor: not-allowed; }
.rh-spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.rh-back {
  display: block;
  text-align: center;
  margin-top: 14px;
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
}
.rh-back:hover { color: #10b981; }
</style>
