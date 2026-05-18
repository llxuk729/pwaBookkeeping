如果是我来做你这个：

# 「PWA 本地离线 AI 智能记账」

我会尽量：

* 不依赖重型模型
* 不依赖后端
* 不依赖 wasm 大 NLP
* 保持移动端可运行
* 保持 Safari 可运行
* 保持 GitHub Pages 静态部署

然后采用：

# “工程化 parser + 小量 AI辅助”

路线。

---

# 一、我会采用的整体技术栈

## 前端框架

### 首选

* [Vue.js](https://vuejs.org/?utm_source=chatgpt.com)
* [Vite](https://vitejs.dev/?utm_source=chatgpt.com)

原因：

* PWA成熟
* 包体小
* 移动端友好
* 开发速度快

---

## PWA

### 使用

* [vite-plugin-pwa](https://vite-pwa-org.netlify.app/?utm_source=chatgpt.com)

功能：

* service worker
* 离线缓存
* install app
* manifest

---

# 二、数据层

## 本地数据库

### 我会选：

* [Dexie.js](https://dexie.org/?utm_source=chatgpt.com)

不要直接手写 IndexedDB。

原因：

* IndexedDB API 太反人类
* Dexie 极稳定
* 查询舒服
* TS支持好

---

## 数据校验

### 使用：

* [Zod](https://zod.dev/?utm_source=chatgpt.com)

例如：

```ts
const RecordSchema = z.object({
  name: z.string(),
  amount: z.number(),
  quantity: z.number().optional(),
})
```

避免：

* NaN
* undefined
* 空记录

---

# 三、Parser 核心（最重要）

这里是核心。

---

# 我不会使用：

* LangChain
* 大模型 Agent
* embedding parser
* LoRA
* transformers.js 主解析

这些对你这个场景：

# 太重。

---

# 四、我会如何做 Parser

采用：

```text id="a1"
Normalize
→ Tokenize
→ Split
→ Money FSM
→ Structuring
```

---

# 五、分词库

## 轻量方案（推荐）

### 使用：

* [compromise.js](https://github.com/spencermountain/compromise?utm_source=chatgpt.com)

原因：

* 很轻
* 浏览器友好
* 速度快

但：

# 只负责 tokenizer。

不负责理解。

---

# 六、中文数字处理

## 我会自己写：

# chinese-number-parser

不要依赖 AI。

---

例如支持：

| 输入     | 输出    |
| ------ | ----- |
| 三块二    | 3.2   |
| 五毛     | 0.5   |
| 两块五    | 2.5   |
| 十二块四毛六 | 12.46 |

---

# 七、最核心：

# Money FSM

我一定会：

# 自己写状态机。

---

例如：

```text id="a2"
START
 ↓
INTEGER
 ↓
YUAN
 ↓
JIAO
 ↓
FEN
```

---

原因：

# 中文金额是 DSL

不是 NLP。

---

# 八、Regex 只做：

## Token级别

例如：

```js
/\d+块\d+毛\d+/
/\d+元/
/\d+瓶/
/x\d+/
```

---

不会：

# 用 regex 直接解析整句话。

否则必炸。

---

# 九、我会加入：

# Pre Normalize

这是非常重要的一层。

---

例如：

| 输入     | 标准化     |
| ------ | ------- |
| 块钱     | 块       |
| 毛钱     | 毛       |
| 两      | 二       |
| 一瓶可乐15 | 可乐×1 15 |

---

# 十、语音输入层

## 浏览器端

使用：

* Web Speech API

或者：

* [Whisper.cpp](https://github.com/ggml-org/whisper.cpp?utm_source=chatgpt.com)（可选）

---

但：

# Whisper 不建议浏览器端常驻。

---

# 十一、AI层（我会怎么用）

## AI不参与主解析

只参与：

* 分类建议
* 标签建议
* 智能备注
* 模糊纠错

---

例如：

```text id="a3"
“星巴克35”
```

AI帮助：

```text id="a4"
可能属于：
餐饮 / 咖啡
```

---

# 十二、如果一定要浏览器AI

我会选：

## 小模型

而不是：

```text id="a5"
0.5B instruct
```

---

我会优先：

## 分类模型

例如：

* Xenova tiny models
* MiniLM
* bge-small（只用于分类）

---

# 十三、移动端优化（非常重要）

## 我会做：

# 分层加载

---

## 第一层

核心 parser：

```text id="a6"
< 100KB
```

---

## 第二层

NLP：

动态 import。

---

## 第三层

AI：

按需下载。

---

# 十四、我会重点做：

# Parser Test Case

建立：

```text id="a7"
1000+ 中文记账case
```

例如：

```text
大米4
豆腐三块五
可乐两瓶15
昨天停车20
```

---

因为：

# parser 的核心不是模型。

而是：

# case coverage。

---

# 十五、未来增强（可选）

## 云增强

复杂句子：

```text id="a8"
昨天请客户吃饭387停车15打车42
```

才：

* 调 API
* 云解析

---

# 十六、如果是我，会避免的东西

## 不会使用：

### 1. LangChain

你这个场景：

# 完全没必要。

---

### 2. Agent

纯增加复杂度。

---

### 3. LoRA

收益极低。

---

### 4. Ollama 浏览器端

移动端不现实。

---

### 5. 重型 transformers.js 推理

Safari 很痛苦。

---

# 十七、我最终会形成的目录结构

```text
src/
 ├── parser/
 │    ├── tokenizer
 │    ├── splitter
 │    ├── money-fsm
 │    ├── chinese-number
 │    ├── normalize
 │    └── validator
 │
 ├── ai/
 │    ├── classify
 │    ├── suggest
 │    └── embeddings
 │
 ├── db/
 │    └── dexie
 │
 ├── speech/
 │
 └── pwa/
```

---

# 十八、真正最值得投入的地方

你未来真正核心壁垒：

不是：

```text id="a9"
用了 AI
```

而是：

# 中文语音记账结构化引擎

尤其：

* 离线
* 本地
* 极速
* 隐私

这个方向其实很少有人认真做。
