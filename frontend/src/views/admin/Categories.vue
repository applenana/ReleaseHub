<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { Apis, type CategoryNode } from '@/api';
import CategoryItem from './CategoryItem.vue';

const dialog = useDialog();
const msg = useMessage();
const tree = ref<CategoryNode[]>([]);

const showCreate = ref(false);
const createForm = ref({
  parent_id: null as number | null,
  name: '',
  slug: '',
  description: '',
});

async function load() {
  tree.value = (await Apis.categories()).tree;
}

function openCreate(parentId: number | null) {
  createForm.value = { parent_id: parentId, name: '', slug: '', description: '' };
  showCreate.value = true;
}

async function submitCreate() {
  if (!createForm.value.name) return msg.warning('请填写名称');
  try {
    await Apis.createCategory({
      parent_id: createForm.value.parent_id,
      name: createForm.value.name,
      slug: createForm.value.slug || undefined,
      description: createForm.value.description || null,
    });
    msg.success('已创建');
    showCreate.value = false;
    load();
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '失败');
  }
}

function renameNode(node: CategoryNode) {
  const newName = prompt('新名称', node.name);
  if (!newName || newName === node.name) return;
  Apis.updateCategory(node.id, { name: newName }).then(() => {
    msg.success('已更新');
    load();
  });
}

function delNode(node: CategoryNode) {
  dialog.warning({
    title: '删除分类',
    content: `删除「${node.name}」会级联删除其所有子分类及关联。继续？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await Apis.deleteCategory(node.id);
      msg.success('已删除');
      load();
    },
  });
}

onMounted(load);
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 16px">
    <div style="font-size:14px;color:#6b7280">支持无限层级</div>
    <n-button type="primary" @click="openCreate(null)">新增顶级分类</n-button>
  </n-space>

  <n-card>
    <ul style="list-style: none; padding-left: 0">
      <CategoryItem
        v-for="n in tree"
        :key="n.id"
        :node="n"
        :on-add-child="openCreate"
        :on-rename="renameNode"
        :on-delete="delNode"
      />
    </ul>
    <n-empty v-if="!tree.length" description="还没有分类，点击右上角新增" />
  </n-card>

  <n-modal v-model:show="showCreate" preset="card" title="新增分类" style="width: 480px">
    <n-form label-placement="top">
      <n-form-item label="父分类">
        <n-input
          :value="createForm.parent_id === null ? '（顶级）' : '#' + createForm.parent_id"
          disabled
        />
      </n-form-item>
      <n-form-item label="名称" required>
        <n-input v-model:value="createForm.name" />
      </n-form-item>
      <n-form-item label="slug（可选，自动生成）">
        <n-input v-model:value="createForm.slug" />
      </n-form-item>
      <n-form-item label="描述">
        <n-input v-model:value="createForm.description" type="textarea" />
      </n-form-item>
      <n-button type="primary" block @click="submitCreate">创建</n-button>
    </n-form>
  </n-modal>
</template>
