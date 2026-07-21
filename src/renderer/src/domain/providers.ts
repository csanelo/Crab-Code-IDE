
export type ProviderApi = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface ProviderDef {
  id: string
  name: string
  description?: string
  api: ProviderApi
  baseUrl: string
  models?: string[]
  url?: string
  recommended?: boolean
}

export const KNOWN_PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Прямой доступ к моделям Claude, включая Sonnet и Haiku.',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    url: 'https://docs.anthropic.com/en/api/getting-started',
    recommended: true,
    models: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest'
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Модели GPT для повседневных задач.',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    url: 'https://platform.openai.com/docs/api-reference',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo']
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Семейство Gemini, включая 2.0 Flash и 1.5 Pro.',
    api: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    url: 'https://ai.google.dev/gemini-api/docs',
    recommended: true,
    models: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Сотни моделей через один API-ключ.',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    url: 'https://openrouter.ai/docs',
    recommended: true,
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'qwen/qwen-2.5-coder-32b-instruct'
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    api: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    url: 'https://docs.mistral.ai/api/',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-large-latest']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Бюджетные модели для кода и ризонинга.',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com',
    url: 'https://api-docs.deepseek.com/',
    recommended: true,
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Самый быстрый стриминг open-source моделей.',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    url: 'https://console.groq.com/docs/quickstart',
    recommended: true,
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ]
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    api: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    url: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
    models: ['llama3.1-8b', 'llama3.1-70b', 'llama-3.3-70b']
  },
  {
    id: 'together',
    name: 'Together AI',
    api: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    url: 'https://docs.together.ai/docs/inference-quickstart',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'deepseek-ai/DeepSeek-V3'
    ]
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    api: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    url: 'https://docs.fireworks.ai/',
    models: [
      'accounts/fireworks/models/deepseek-v3',
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/qwen2p5-coder-32b-instruct'
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    api: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    url: 'https://docs.perplexity.ai/',
    models: ['sonar', 'sonar-pro', 'sonar-reasoning']
  },
  {
    id: 'cohere',
    name: 'Cohere',
    api: 'openai',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    url: 'https://docs.cohere.com/',
    models: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-r7b-12-2024']
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    url: 'https://docs.x.ai/api',
    models: ['grok-4', 'grok-3', 'grok-3-mini']
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    api: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    url: 'https://platform.moonshot.ai/docs',
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k']
  },
  {
    id: 'github',
    name: 'GitHub Models',
    api: 'openai',
    baseUrl: 'https://models.inference.ai.azure.com',
    url: 'https://docs.github.com/en/github-models',
    models: ['gpt-4o', 'gpt-4o-mini', 'Phi-3.5-MoE-instruct', 'Mistral-Large-2411']
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    api: 'openai',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    url: 'https://huggingface.co/docs/api-inference',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct']
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    api: 'openai',
    baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT',
    url: 'https://learn.microsoft.com/azure/ai-services/openai/',
    models: []
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    api: 'custom',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    url: 'https://docs.aws.amazon.com/bedrock/',
    models: [
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'meta.llama3-3-70b-instruct-v1:0'
    ]
  },
  {
    id: 'vertex',
    name: 'Google Vertex AI',
    api: 'custom',
    baseUrl: 'https://us-central1-aiplatform.googleapis.com',
    url: 'https://cloud.google.com/vertex-ai/docs',
    models: ['gemini-2.0-flash-001', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002']
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    api: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    url: 'https://ollama.com/',
    models: ['llama3.3', 'qwen2.5-coder:32b', 'deepseek-r1', 'mistral']
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    api: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    url: 'https://lmstudio.ai/docs/local-server',
    models: []
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    api: 'openai',
    baseUrl: 'https://api.siliconflow.com/v1',
    url: 'https://docs.siliconflow.com/',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-Coder-32B-Instruct']
  },
  {
    id: 'novita',
    name: 'NovitaAI',
    api: 'openai',
    baseUrl: 'https://api.novita.ai/v3/openai',
    url: 'https://novita.ai/docs',
    models: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen-2.5-coder-32b-instruct']
  },
  {
    id: 'deepinfra',
    name: 'Deep Infra',
    api: 'openai',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    url: 'https://deepinfra.com/docs',
    models: [
      'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-Coder-32B-Instruct'
    ]
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'Ускоренный инференс моделей на NVIDIA NIM (build.nvidia.com).',
    api: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    url: 'https://docs.nvidia.com/nim/',
    recommended: true,
    models: [
      'deepseek-ai/deepseek-r1',
      'meta/llama-3.3-70b-instruct',
      'meta/llama-3.1-405b-instruct',
      'qwen/qwen2.5-coder-32b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-large-2-instruct'
    ]
  },
  {
    id: 'zhipu',
    name: 'Z.AI (GLM)',
    description: 'Модели GLM-4.6 и GLM-4.5 от Zhipu AI.',
    api: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    url: 'https://docs.z.ai/',
    models: ['glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4-flash']
  },
  {
    id: 'alibaba',
    name: 'Alibaba (Qwen)',
    description: 'Модели Qwen через DashScope (OpenAI-совместимый режим).',
    api: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    url: 'https://www.alibabacloud.com/help/en/model-studio/',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-coder-32b-instruct', 'qwq-32b']
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'Модели MiniMax с длинным контекстом.',
    api: 'openai',
    baseUrl: 'https://api.minimax.io/v1',
    url: 'https://www.minimax.io/platform',
    models: ['MiniMax-Text-01', 'abab6.5s-chat']
  },
  {
    id: 'baseten',
    name: 'Baseten',
    api: 'openai',
    baseUrl: 'https://inference.baseten.co/v1',
    url: 'https://docs.baseten.co/',
    models: ['deepseek-ai/DeepSeek-V3', 'meta-llama/Llama-3.3-70B-Instruct']
  },
  {
    id: 'nebius',
    name: 'Nebius AI',
    api: 'openai',
    baseUrl: 'https://api.studio.nebius.com/v1',
    url: 'https://docs.nebius.com/studio/inference/',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'meta-llama/Llama-3.3-70B-Instruct',
      'Qwen/Qwen2.5-Coder-32B-Instruct'
    ]
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    description: 'Быстрый инференс open-source моделей.',
    api: 'openai',
    baseUrl: 'https://api.sambanova.ai/v1',
    url: 'https://docs.sambanova.ai/',
    models: ['Meta-Llama-3.3-70B-Instruct', 'Qwen2.5-Coder-32B-Instruct', 'DeepSeek-R1']
  },
  {
    id: 'hyperbolic',
    name: 'Hyperbolic',
    api: 'openai',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    url: 'https://docs.hyperbolic.xyz/',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'deepseek-ai/DeepSeek-V3', 'Qwen/QwQ-32B']
  },
  {
    id: 'lambda',
    name: 'Lambda',
    description: 'Inference API на GPU Lambda.',
    api: 'openai',
    baseUrl: 'https://api.lambda.ai/v1',
    url: 'https://docs.lambda.ai/',
    models: ['llama-3.3-70b-instruct-fp8', 'deepseek-v3-0324', 'qwen25-coder-32b-instruct']
  },
  {
    id: 'anyscale',
    name: 'Anyscale',
    api: 'openai',
    baseUrl: 'https://api.endpoints.anyscale.com/v1',
    url: 'https://docs.anyscale.com/',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1']
  },
  {
    id: 'octoai',
    name: 'OctoAI',
    api: 'openai',
    baseUrl: 'https://text.octoai.run/v1',
    url: 'https://octo.ai/docs/',
    models: ['meta-llama-3.1-70b-instruct', 'mixtral-8x7b-instruct']
  },
  {
    id: 'ai21',
    name: 'AI21 Labs',
    description: 'Семейство моделей Jamba.',
    api: 'openai',
    baseUrl: 'https://api.ai21.com/studio/v1',
    url: 'https://docs.ai21.com/',
    models: ['jamba-1.5-large', 'jamba-1.5-mini']
  },
  {
    id: 'upstage',
    name: 'Upstage',
    description: 'Модели Solar Pro.',
    api: 'openai',
    baseUrl: 'https://api.upstage.ai/v1/solar',
    url: 'https://developers.upstage.ai/',
    models: ['solar-pro', 'solar-mini']
  },
  {
    id: 'reka',
    name: 'Reka AI',
    api: 'openai',
    baseUrl: 'https://api.reka.ai/v1',
    url: 'https://docs.reka.ai/',
    models: ['reka-core', 'reka-flash', 'reka-edge']
  },
  {
    id: 'inflection',
    name: 'Inflection AI',
    api: 'openai',
    baseUrl: 'https://api.inflection.ai/v1',
    url: 'https://developers.inflection.ai/',
    models: ['inflection_3_pi', 'inflection_3_productivity']
  },
  {
    id: 'writer',
    name: 'Writer',
    description: 'Модели Palmyra для бизнеса.',
    api: 'openai',
    baseUrl: 'https://api.writer.com/v1',
    url: 'https://dev.writer.com/',
    models: ['palmyra-x-004', 'palmyra-x-003-instruct']
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    description: 'Эмбеддинги и реранкинг.',
    api: 'openai',
    baseUrl: 'https://api.voyageai.com/v1',
    url: 'https://docs.voyageai.com/',
    models: ['voyage-3', 'voyage-3-lite', 'voyage-code-3']
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    api: 'openai',
    baseUrl: 'https://api.stepfun.com/v1',
    url: 'https://platform.stepfun.com/',
    models: ['step-2-16k', 'step-1-flash', 'step-1v-8k']
  },
  {
    id: 'baichuan',
    name: 'Baichuan AI',
    api: 'openai',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    url: 'https://platform.baichuan-ai.com/',
    models: ['Baichuan4', 'Baichuan3-Turbo']
  },
  {
    id: 'yi',
    name: '01.AI (Yi)',
    api: 'openai',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    url: 'https://platform.lingyiwanwu.com/',
    models: ['yi-large', 'yi-medium', 'yi-lightning']
  },
  {
    id: 'tencent',
    name: 'Tencent Hunyuan',
    api: 'openai',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    url: 'https://cloud.tencent.com/document/product/1729',
    models: ['hunyuan-turbo', 'hunyuan-large', 'hunyuan-standard']
  },
  {
    id: 'sarvam',
    name: 'Sarvam AI',
    description: 'Модели для индийских языков.',
    api: 'openai',
    baseUrl: 'https://api.sarvam.ai/v1',
    url: 'https://docs.sarvam.ai/',
    models: ['sarvam-m']
  },
  {
    id: 'venice',
    name: 'Venice AI',
    description: 'Приватный инференс без логирования.',
    api: 'openai',
    baseUrl: 'https://api.venice.ai/api/v1',
    url: 'https://docs.venice.ai/',
    models: ['llama-3.3-70b', 'qwen-2.5-coder-32b', 'deepseek-r1-671b']
  },
  {
    id: 'chutes',
    name: 'Chutes',
    api: 'openai',
    baseUrl: 'https://llm.chutes.ai/v1',
    url: 'https://chutes.ai/',
    models: ['deepseek-ai/DeepSeek-V3', 'unsloth/Llama-3.3-70B-Instruct']
  },
  {
    id: 'kluster',
    name: 'Kluster AI',
    api: 'openai',
    baseUrl: 'https://api.kluster.ai/v1',
    url: 'https://docs.kluster.ai/',
    models: ['deepseek-ai/DeepSeek-V3', 'klusterai/Meta-Llama-3.3-70B-Instruct-Turbo']
  },
  {
    id: 'gmicloud',
    name: 'GMI Cloud',
    api: 'openai',
    baseUrl: 'https://api.gmi-serving.com/v1',
    url: 'https://docs.gmicloud.ai/',
    models: ['deepseek-ai/DeepSeek-R1', 'meta-llama/Llama-3.3-70B-Instruct']
  },
  {
    id: 'scaleway',
    name: 'Scaleway',
    description: 'Европейский AI-инференс.',
    api: 'openai',
    baseUrl: 'https://api.scaleway.ai/v1',
    url: 'https://www.scaleway.com/en/docs/generative-apis/',
    models: ['llama-3.3-70b-instruct', 'qwen2.5-coder-32b-instruct', 'mistral-nemo-instruct-2407']
  },
  {
    id: 'ovhcloud',
    name: 'OVHcloud AI',
    description: 'Европейские AI Endpoints.',
    api: 'openai',
    baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    url: 'https://endpoints.ai.cloud.ovh.net/',
    models: ['Meta-Llama-3_3-70B-Instruct', 'Qwen2.5-Coder-32B-Instruct']
  },
  {
    id: 'modelscope',
    name: 'ModelScope',
    api: 'openai',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    url: 'https://modelscope.cn/docs',
    models: ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-V3']
  },
  {
    id: 'qiniu',
    name: 'Qiniu',
    api: 'openai',
    baseUrl: 'https://api.qnaigc.com/v1',
    url: 'https://developer.qiniu.com/aitokenapi',
    models: ['deepseek-v3', 'qwen2.5-coder-32b-instruct']
  },
  {
    id: 'jina',
    name: 'Jina AI',
    description: 'Эмбеддинги и reader-модели.',
    api: 'openai',
    baseUrl: 'https://api.jina.ai/v1',
    url: 'https://jina.ai/',
    models: ['jina-embeddings-v3', 'jina-reranker-v2-base-multilingual']
  },
  {
    id: 'custom',
    name: 'Custom provider',
    api: 'custom',
    baseUrl: '',
    url: undefined,
    models: []
  }
]

export function getProvider(id: string): ProviderDef | undefined {
  return KNOWN_PROVIDERS.find((p) => p.id === id)
}

export const CUSTOM_NAMES: string[] = [
  '302.AI',
  'Abacus',
  'abliteration.ai',
  'AIHubMix',
  'Alibaba',
  'Alibaba (China)',
  'Alibaba Coding Plan',
  'Alibaba Coding Plan (China)',
  'Alibaba Token Plan',
  'Alibaba Token Plan (China)',
  'Amazon Bedrock',
  'Ambient',
  'AnyAPI',
  'Atomic Chat',
  'Auriko',
  'Azure',
  'Azure Cognitive Services',
  'Bailing',
  'Baseten',
  'Berget.AI',
  'Cerebras',
  'Chutes',
  'Clarifai',
  'Claudinio',
  'CloudFerro Sherlock',
  'Cloudflare AI Gateway',
  'Cloudflare Workers AI',
  'Cohere',
  'Cortecs',
  'CrofAI',
  'D.Run (China)',
  'Databricks',
  'Deep Infra',
  'DeepSeek',
  'DigitalOcean',
  'DInference',
  'evroc',
  'FastRouter',
  'Fireworks (Firepass)',
  'Fireworks AI',
  'FreeModel',
  'Friendli',
  'FrogBot',
  'GitHub Models',
  'GitLab Duo',
  'GMI Cloud',
  'Groq',
  'Helicone',
  'HPC-AI',
  'Hugging Face',
  'iFlow',
  'Inception',
  'Inceptron',
  'Inference',
  'IO.NET',
  'Jiekou.AI',
  'Kilo Gateway',
  'Kimi For Coding',
  'KUAE Cloud Coding Plan',
  'Lilac',
  'Llama',
  'LLM Gateway',
  'LLMTR',
  'LMStudio',
  'LucidQuery AI',
  'Meganova',
  'Merge Gateway',
  'MiniMax (minimax.io)',
  'MiniMax (minimaxi.com)',
  'MiniMax Token Plan (minimax.io)',
  'MiniMax Token Plan (minimaxi.com)',
  'Mistral',
  'Mixlayer',
  'Moark',
  'ModelScope',
  'Moonshot AI',
  'Moonshot AI (China)',
  'Morph',
  'NanoGPT',
  'NEAR AI Cloud',
  'Nebius Token Factory',
  'Neon',
  'Neuralwatt',
  'Nova',
  'NovitaAI',
  'Nvidia',
  'Ollama Cloud',
  'OrcaRouter',
  'OVHcloud AI Endpoints',
  'Perplexity',
  'Perplexity Agent',
  'Poe',
  'Poolside',
  'Privatemode AI',
  'QiHang',
  'Qiniu',
  'Regolo AI',
  'Requesty',
  'routing.run',
  'SAP AI Core',
  'Sarvam AI',
  'Scaleway',
  'SiliconFlow',
  'SiliconFlow (China)',
  'Snowflake Cortex',
  'STACKIT',
  'StepFun',
  'StepFun AI',
  'submodel',
  'Synthetic',
  'Tencent Coding Plan (China)',
  'Tencent TokenHub',
  'The Grid AI',
  'Together AI',
  'Umans AI Coding Plan',
  'Upstage',
  'v0',
  'Venice AI',
  'Vertex',
  'Vertex (Anthropic)',
  'Vivgrid',
  'Vultr',
  'Wafer',
  'Weights & Biases',
  'xAI',
  'Xiaomi',
  'Xiaomi Token Plan (China)',
  'Xiaomi Token Plan (Europe)',
  'Xiaomi Token Plan (Singapore)',
  'Xpersona',
  'Z.AI',
  'Z.AI Coding Plan',
  'Zeldoc',
  'ZenMux',
  'Zhipu AI',
  'Zhipu AI Coding Plan'
]
