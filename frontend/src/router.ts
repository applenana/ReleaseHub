import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/Home.vue') },
    {
      path: '/firmwares/:id',
      name: 'firmware-detail',
      component: () => import('./views/FirmwareDetail.vue'),
    },
    { path: '/login', name: 'login', component: () => import('./views/Login.vue') },
    {
      path: '/admin',
      component: () => import('./views/admin/Layout.vue'),
      meta: { requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/firmwares' },
        {
          path: 'firmwares',
          name: 'admin-firmwares',
          component: () => import('./views/admin/Firmwares.vue'),
        },
        {
          path: 'firmwares/new',
          name: 'admin-firmware-new',
          component: () => import('./views/admin/FirmwareEdit.vue'),
        },
        {
          path: 'firmwares/:id/edit',
          name: 'admin-firmware-edit',
          component: () => import('./views/admin/FirmwareEdit.vue'),
        },
        {
          path: 'categories',
          name: 'admin-categories',
          component: () => import('./views/admin/Categories.vue'),
        },
        {
          path: 'channels',
          name: 'admin-channels',
          component: () => import('./views/admin/Channels.vue'),
        },
        {
          path: 'tags',
          name: 'admin-tags',
          component: () => import('./views/admin/Tags.vue'),
        },
        {
          path: 'tokens',
          name: 'admin-tokens',
          component: () => import('./views/admin/Tokens.vue'),
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin) {
    try {
      const { api } = await import('./api');
      await api.get('/api/admin/me');
    } catch {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }
});

export default router;
