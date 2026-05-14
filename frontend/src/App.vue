<script setup lang="ts">
import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui';
import { ref, computed } from 'vue';

const dark = ref(localStorage.getItem('rh_dark') === '1');
const theme = computed<GlobalTheme | null>(() => (dark.value ? darkTheme : null));

// 全局圆角 + 现代主色
const themeOverrides: GlobalThemeOverrides = {
  common: {
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    primaryColor: '#3b82f6',
    primaryColorHover: '#60a5fa',
    primaryColorPressed: '#2563eb',
    primaryColorSuppl: '#3b82f6',
    fontWeightStrong: '600',
  },
  Card: {
    borderRadius: '16px',
    paddingMedium: '20px 24px',
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
  },
  Input: {
    borderRadius: '10px',
  },
  Tag: {
    borderRadius: '999px',
  },
};

function toggleTheme() {
  dark.value = !dark.value;
  localStorage.setItem('rh_dark', dark.value ? '1' : '0');
}
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view :toggle-theme="toggleTheme" :dark="dark" />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
