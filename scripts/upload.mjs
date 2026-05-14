#!/usr/bin/env node
/**
 * 示例：通过 API 上传固件
 * 用法：
 *   API_URL=http://127.0.0.1:3001 API_TOKEN=rh_xxx node scripts/upload.mjs ./firmware.bin
 */
import fs from 'node:fs';
import path from 'node:path';

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const API_TOKEN = process.env.API_TOKEN;
const filePath = process.argv[2];

if (!API_TOKEN) {
  console.error('请设置环境变量 API_TOKEN');
  process.exit(1);
}
if (!filePath || !fs.existsSync(filePath)) {
  console.error('请提供有效的固件文件路径');
  process.exit(1);
}

const meta = {
  title: '3.2寸 MLX 双光固件',
  version: '1.2.3',
  patch_suffix: null,
  channel_key: 'stable',
  category_ids: [],          // 填入分类 ID
  tag_names: ['推荐'],       // 自动创建标签
  changelog: '## 1.2.3\n- 修复某 bug\n- 新增某功能\n',
};

const fd = new FormData();
fd.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
fd.append('meta', JSON.stringify(meta));

const res = await fetch(`${API_URL}/api/v1/firmwares`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${API_TOKEN}` },
  body: fd,
});

const data = await res.json();
if (!res.ok) {
  console.error('上传失败:', data);
  process.exit(1);
}
console.log('✓ 上传成功');
console.log(JSON.stringify(data, null, 2));
