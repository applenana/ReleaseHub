<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import {
  Apis,
  type Category,
  type CategoryNode,
  type Channel,
  type Tag,
} from '@/api';

const route = useRoute();
const router = useRouter();
const msg = useMessage();

const isEdit = computed(() => !!route.params.id);
const id = computed(() => parseInt(route.params.id as string, 10));

const categories = ref<{ flat: Category[]; tree: CategoryNode[] }>({ flat: [], tree: [] });
const channels = ref<Channel[]>([]);
const tags = ref<Tag[]>([]);

const form = ref({
  title: '',
  version: '',
  patch_suffix: '',
  channel_id: null as number | null,
  changelog: '',
  category_ids: [] as number[],
  tag_ids: [] as number[],
  tag_names: '' as string,
});
const file = ref<File | null>(null);
const uploading = ref(false);
const progress = ref(0);

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

async function loadMeta() {
  const [c, ch, t] = await Promise.all([Apis.categories(), Apis.channels(), Apis.tags()]);
  categories.value = c;
  channels.value = ch;
  tags.value = t;
  if (!form.value.channel_id && ch.length) form.value.channel_id = ch[0].id;
}

async function loadExisting() {
  const fw = await Apis.firmware(id.value);
  form.value.title = fw.title;
  form.value.version = fw.version;
  form.value.patch_suffix = fw.patch_suffix ?? '';
  form.value.channel_id = fw.channel_id;
  form.value.changelog = fw.changelog;
  form.value.category_ids = fw.categories.map((c) => c.id);
  form.value.tag_ids = fw.tags.map((t) => t.id);
}

async function submit() {
  if (!form.value.title || !form.value.version || !form.value.channel_id) {
    msg.warning('请完整填写');
    return;
  }
  uploading.value = true;
  try {
    if (isEdit.value) {
      await Apis.updateFirmware(id.value, {
        title: form.value.title,
        version: form.value.version,
        patch_suffix: form.value.patch_suffix || null,
        channel_id: form.value.channel_id,
        changelog: form.value.changelog,
        category_ids: form.value.category_ids,
        tag_ids: form.value.tag_ids,
      });
      msg.success('已保存');
      router.push('/admin/firmwares');
    } else {
      if (!file.value) {
        msg.warning('请选择固件文件');
        uploading.value = false;
        return;
      }
      const fd = new FormData();
      fd.append('file', file.value);
      fd.append(
        'meta',
        JSON.stringify({
          title: form.value.title,
          version: form.value.version,
          patch_suffix: form.value.patch_suffix || null,
          channel_id: form.value.channel_id,
          changelog: form.value.changelog,
          category_ids: form.value.category_ids,
          tag_ids: form.value.tag_ids,
          tag_names: form.value.tag_names
            ? form.value.tag_names.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      );
      await Apis.uploadFirmware(fd, (p) => (progress.value = p));
      msg.success('上传成功');
      router.push('/admin/firmwares');
    }
  } catch (e: any) {
    msg.error(e?.response?.data?.error || '操作失败');
  } finally {
    uploading.value = false;
  }
}

onMounted(async () => {
  await loadMeta();
  if (isEdit.value) await loadExisting();
});
</script>

<template>
  <n-h2>{{ isEdit ? '编辑固件' : '上传新固件' }}</n-h2>
  <n-form label-placement="top" style="max-width: 900px">
    <n-grid :cols="2" :x-gap="16">
      <n-form-item-gi label="标题" required>
        <n-input v-model:value="form.title" placeholder="例如：3.2寸 MLX 双光固件" />
      </n-form-item-gi>
      <n-form-item-gi label="通道" required>
        <n-select
          v-model:value="form.channel_id"
          :options="channels.map((c) => ({ label: c.label, value: c.id }))"
        />
      </n-form-item-gi>
      <n-form-item-gi label="版本号" required>
        <n-input v-model:value="form.version" placeholder="例如：1.2.3" />
      </n-form-item-gi>
      <n-form-item-gi label="补丁后缀">
        <n-input v-model:value="form.patch_suffix" placeholder="可选，例如 patch1" />
      </n-form-item-gi>
    </n-grid>

    <n-form-item label="分类">
      <n-tree
        :data="categoryTreeData"
        checkable
        expand-on-click
        :default-expand-all="true"
        :checked-keys="form.category_ids"
        @update:checked-keys="(k: number[]) => (form.category_ids = k)"
        block-line
      />
    </n-form-item>

    <n-form-item label="标签">
      <n-select
        v-model:value="form.tag_ids"
        multiple
        filterable
        :options="tags.map((t) => ({ label: t.name, value: t.id }))"
      />
    </n-form-item>
    <n-form-item v-if="!isEdit" label="新增标签（逗号分隔，自动创建）">
      <n-input v-model:value="form.tag_names" placeholder="例如：推荐, 新功能" />
    </n-form-item>

    <n-form-item v-if="!isEdit" label="固件文件" required>
      <n-upload
        :max="1"
        :default-upload="false"
        @change="(o: any) => (file = o.fileList[0]?.file ?? null)"
      >
        <n-button>选择文件</n-button>
      </n-upload>
    </n-form-item>

    <n-form-item label="更新日志（Markdown）">
      <md-editor v-model="form.changelog" :preview="false" style="height: 380px" />
    </n-form-item>

    <n-progress v-if="uploading && !isEdit" :percentage="progress" />

    <n-space>
      <n-button type="primary" :loading="uploading" @click="submit">
        {{ isEdit ? '保存' : '上传' }}
      </n-button>
      <n-button @click="router.push('/admin/firmwares')">取消</n-button>
    </n-space>
  </n-form>
</template>
