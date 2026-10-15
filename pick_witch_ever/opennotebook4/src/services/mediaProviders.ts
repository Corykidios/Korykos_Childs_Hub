import { ImageProvider, VideoProvider } from '../types';

export interface MediaProviderMeta<T extends string> {
  id: T;
  name: string;
  badge: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: { id: string; name: string; specs: string }[];
  keyHint: string;
  isLocal?: boolean;
  docUrl: string;
}

export const IMAGE_PROVIDERS: Record<ImageProvider, MediaProviderMeta<ImageProvider>> = {
  google: {
    id: 'google',
    name: 'Google Gemini Image',
    badge: 'Nano Banana (4K & Multimodal)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.1-flash-image',
    models: [
      { 
        id: 'gemini-3.1-flash-image', 
        name: 'Gemini 3.1 Flash Image (Nano Banana 2)', 
        specs: 'Generalist workhorse model. 4K generation, text in image, multi-reference consistency' 
      },
      { 
        id: 'gemini-3.1-flash-lite-image', 
        name: 'Gemini 3.1 Flash Lite Image (Nano Banana 2 Lite)', 
        specs: 'Fastest & cheapest Gemini image model for scale and high throughput' 
      },
      { 
        id: 'gemini-3-pro-image', 
        name: 'Gemini 3 Pro Image (Nano Banana Pro)', 
        specs: 'Premium choice for complex visuals, high-precision world knowledge & brand consistency' 
      },
      { 
        id: 'gemini-2.5-flash-image', 
        name: 'Gemini 2.5 Flash Image (Nano Banana)', 
        specs: 'Legacy pioneer model in the Gemini image generation series' 
      },
    ],
    keyHint: 'AIzaSy... (Uses standard Gemini API key)',
    docUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Image (GPT-Image & DALL·E)',
    badge: 'GPT-Image 2.5 Sunburst & Flare',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-image-2.5-sunburst',
    models: [
      { id: 'gpt-image-2.5-sunburst', name: 'GPT-Image-2.5 Sunburst', specs: 'Flagship model for precision generation and editing. Low/med/high/xhigh/max quality.' },
      { id: 'gpt-image-2.5-flare', name: 'GPT-Image-2.5 Flare', specs: 'Fast, high-throughput everyday image generation.' },
      { id: 'dall-e-3', name: 'DALL·E 3 (HD / Standard)', specs: '1024x1024, 1024x1792, 1792x1024 with detailed prompt adherence' },
      { id: 'dall-e-2', name: 'DALL·E 2', specs: '256x256, 512x512, 1024x1024 legacy generator' },
    ],
    keyHint: 'sk-proj-... or sk-...',
    docUrl: 'https://platform.openai.com/docs/guides/images',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Multimodal',
    badge: 'Gemini, GPT-Image, FLUX',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-3.1-flash-image',
    models: [
      { id: 'google/gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Nano Banana 2)', specs: 'Nano Banana 2 4K generation via OpenRouter' },
      { id: 'google/gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image', specs: 'High throughput light Gemini image model' },
      { id: 'google/gemini-3-pro-image', name: 'Gemini 3 Pro Image (Nano Banana Pro)', specs: 'Flagship image generation with world knowledge' },
      { id: 'openai/gpt-5.4-image-2', name: 'OpenAI GPT-5.4 Image 2', specs: 'OpenAI multimodal generation router' },
      { id: 'openai/gpt-5-image', name: 'OpenAI GPT-5 Image', specs: 'OpenAI high-fidelity image generator' },
      { id: 'openai/gpt-5-image-mini', name: 'OpenAI GPT-5 Image Mini', specs: 'Fast OpenAI image generation' },
      { id: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', specs: 'Pioneer Gemini image generation model' },
    ],
    keyHint: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai',
  },
  comfyui: {
    id: 'comfyui',
    name: 'ComfyUI (Local GPU)',
    badge: '100% Local / Zero API Cost',
    defaultBaseUrl: 'http://localhost:8188',
    defaultModel: 'flux1-dev.safetensors',
    models: [
      { id: 'flux1-dev.safetensors', name: 'FLUX.1 [dev] Checkpoint', specs: 'Black Forest Labs 12B guidance-distilled flagship' },
      { id: 'flux1-schnell.safetensors', name: 'FLUX.1 [schnell] Checkpoint', specs: 'Fast 4-step high-speed local diffusion' },
      { id: 'sd_xl_base_1.0.safetensors', name: 'SDXL 1.0 Base', specs: 'Native 1024x1024 Stable Diffusion XL weights' },
      { id: 'sd3.5_large.safetensors', name: 'Stable Diffusion 3.5 Large', specs: '8.1B MMDiT multi-modal architecture' },
      { id: 'qwen_image.safetensors', name: 'Qwen Image Checkpoint', specs: 'Alibaba Qwen visual generation model' },
      { id: 'hunyuan_image_2.1.safetensors', name: 'Hunyuan Image 2.1', specs: 'Tencent Hunyuan DiT image model' },
      { id: 'v1-5-pruned-emaonly.safetensors', name: 'Stable Diffusion 1.5', specs: 'Classic 512x512 community workhorse' },
    ],
    keyHint: 'No API key needed (Connects to ComfyUI port :8188)',
    isLocal: true,
    docUrl: 'https://github.com/comfyanonymous/ComfyUI',
  },
};

export const VIDEO_PROVIDERS: Record<VideoProvider, MediaProviderMeta<VideoProvider>> = {
  google: {
    id: 'google',
    name: 'Google Veo',
    badge: 'Veo 3.1 & 2.0 (1080p Cinematic)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'veo-3.1-generate-preview',
    models: [
      { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Generate Preview', specs: 'Latest flagship generative video model with cinematic physics' },
      { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite Generate Preview', specs: 'High-speed generative video preview' },
      { id: 'veo-2.0-generate-001', name: 'Veo 2.0 (Production 001)', specs: '1080p high definition with camera controls' },
    ],
    keyHint: 'AIzaSy... (Uses Gemini API Key)',
    docUrl: 'https://ai.google.dev/gemini-api/docs/veo',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Sora',
    badge: 'Sora 2 & Sora 2 Pro (1080p)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'sora-2',
    models: [
      { id: 'sora-2', name: 'Sora 2', specs: 'High-speed flexible video generation for rapid iteration (16s & 20s clips)' },
      { id: 'sora-2-pro', name: 'Sora 2 Pro', specs: 'Production-quality 1080p exports (1920x1080 or 1080x1920), cinematic stability' },
    ],
    keyHint: 'sk-proj-... or sk-...',
    docUrl: 'https://platform.openai.com/docs/guides/video-generation',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Video',
    badge: 'Luma, Kling, Minimax Router',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'luma/dream-machine',
    models: [
      { id: 'luma/dream-machine', name: 'Luma Dream Machine', specs: 'Smooth cinematic motion & camera angles' },
      { id: 'kling/kling-v1.5', name: 'Kling 1.5', specs: 'Complex physics & dynamics simulation' },
      { id: 'minimax/video-01', name: 'Minimax Video-01', specs: 'High temporal consistency' },
    ],
    keyHint: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai',
  },
  comfyui: {
    id: 'comfyui',
    name: 'ComfyUI Video (Local GPU)',
    badge: 'Wan 2.1, Hunyuan, LTX, CogVideoX',
    defaultBaseUrl: 'http://localhost:8188',
    defaultModel: 'wan2.1_t2v_14B.safetensors',
    models: [
      { id: 'wan2.1_t2v_14B.safetensors', name: 'Alibaba Wan 2.1 (14B)', specs: 'Current SOTA open-weights text-to-video' },
      { id: 'wan2.1_t2v_1.3B.safetensors', name: 'Alibaba Wan 2.1 (1.3B)', specs: 'Consumer GPU friendly (8GB VRAM)' },
      { id: 'hunyuan_video_720_cfgdistill_bf16.safetensors', name: 'Tencent HunyuanVideo (13B)', specs: '720p HD open source video generator' },
      { id: 'ltx-video-2b-v0.9.safetensors', name: 'Lightricks LTX-Video 2 / 2.3', specs: 'Realtime video diffusion architecture' },
      { id: 'cogvideox_5b.safetensors', name: 'THUDM CogVideoX-5B', specs: 'Transformer video diffusion' },
      { id: 'mochi_preview.safetensors', name: 'Genmo Mochi 1 Preview', specs: 'High-motion dynamics 10B DiT model' },
      { id: 'animatediff_v3.safetensors', name: 'AnimateDiff v3', specs: 'Motion module for local SD checkpoints' },
      { id: 'svd_xt.safetensors', name: 'Stable Video Diffusion (SVD-XT)', specs: 'Image-to-video 25 frames' },
    ],
    keyHint: 'No API key needed (Runs on local GPU)',
    isLocal: true,
    docUrl: 'https://github.com/comfyanonymous/ComfyUI',
  },
};
