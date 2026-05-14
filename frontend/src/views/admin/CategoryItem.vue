<script setup lang="ts">
import type { PropType } from 'vue';
import { NButton, NSpace } from 'naive-ui';
import type { CategoryNode } from '@/api';

defineProps({
  node: { type: Object as PropType<CategoryNode>, required: true },
  onAddChild: { type: Function as PropType<(pid: number) => void>, required: true },
  onRename: { type: Function as PropType<(n: CategoryNode) => void>, required: true },
  onDelete: { type: Function as PropType<(n: CategoryNode) => void>, required: true },
});
</script>

<template>
  <li style="margin: 4px 0">
    <div style="display: flex; align-items: center; gap: 8px">
      <span style="font-weight: 500">{{ node.name }}</span>
      <span style="opacity: 0.5; font-size: 12px">#{{ node.id }} · depth {{ node.depth }}</span>
      <n-space size="small">
        <n-button size="tiny" @click="onAddChild(node.id)">+ 子分类</n-button>
        <n-button size="tiny" @click="onRename(node)">重命名</n-button>
        <n-button size="tiny" type="error" @click="onDelete(node)">删除</n-button>
      </n-space>
    </div>
    <ul
      v-if="node.children.length"
      style="list-style: none; padding-left: 24px; border-left: 1px dashed #ccc; margin-left: 8px"
    >
      <CategoryItem
        v-for="c in node.children"
        :key="c.id"
        :node="c"
        :on-add-child="onAddChild"
        :on-rename="onRename"
        :on-delete="onDelete"
      />
    </ul>
  </li>
</template>

<script lang="ts">
export default { name: 'CategoryItem' };
</script>
