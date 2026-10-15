import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  parseBody,
  searchWeb,
  scrapeUrl,
  extractYoutube,
  parsePdf,
  buildRagPrompt,
  cleanSourceContent,
  synthesizeLocalResponse,
  generateLocalArtifact,
  generateLocalSourceGuide,
  generateReportSuggestions,
  generateInfographicImageBackend,
  runDeepResearchEngine
} from './src/server/router';

// Vite plugin to fetch live models and handle server-side AI/RAG routes without CORS issues
function modelFetcherPlugin(): Plugin {
  const registerRoutes = (server: any) => {
    server.middlewares.use('/api/models', async (req: any, res: any) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { 
                provider, 
                apiKey, 
                baseUrl, 
                ollamaUrl, 
                lmStudioUrl, 
                comfyUiUrl,
                mediaType 
              } = JSON.parse(body || '{}');
              
              let models: string[] = [];

              // Handle IMAGE & VIDEO model fetching
              if (mediaType === 'image') {
                switch (provider) {
                  case 'google':
                    models = [
                      'gemini-3.1-flash-image',
                      'gemini-3.1-flash-lite-image',
                      'gemini-3-pro-image',
                      'gemini-2.5-flash-image',
                    ];
                    break;

                  case 'openai':
                    if (apiKey) {
                      try {
                        const resp = await fetch('https://api.openai.com/v1/models', {
                          headers: { Authorization: `Bearer ${apiKey}` },
                          signal: AbortSignal.timeout(5000),
                        });
                        if (resp.ok) {
                          const data = await resp.json();
                          const found = (data.data || [])
                            .map((m: any) => m.id)
                            .filter((id: string) => id.includes('gpt-image') || id.includes('dall-e'));
                          if (found.length > 0) models = found;
                        }
                      } catch (e) {}
                    }
                    if (models.length === 0) {
                      models = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'dall-e-3', 'dall-e-2'];
                    }
                    break;

                  case 'openrouter': {
                    const resp = await fetch('https://openrouter.ai/api/v1/models');
                    if (resp.ok) {
                      const data = await resp.json();
                      models = (data.data || [])
                        .map((m: any) => m.id)
                        .filter((id: string) => 
                          id.includes('flux') || 
                          id.includes('diffusion') || 
                          id.includes('recraft') || 
                          id.includes('ideogram') ||
                          id.includes('image')
                        );
                    }
                    if (models.length === 0) {
                      models = [
                        'google/gemini-3.1-flash-image',
                        'google/gemini-3.1-flash-lite-image',
                        'google/gemini-3-pro-image',
                        'openai/gpt-5.4-image-2',
                        'openai/gpt-5-image',
                        'openai/gpt-5-image-mini',
                        'google/gemini-2.5-flash-image',
                      ];
                    }
                    break;
                  }

                  case 'comfyui': {
                    const target = comfyUiUrl || 'http://localhost:8188';
                    try {
                      const resp = await fetch(`${target}/object_info/CheckpointLoaderSimple`, { signal: AbortSignal.timeout(2000) });
                      if (resp.ok) {
                        const data = await resp.json();
                        const checkPoints = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
                        if (Array.isArray(checkPoints) && checkPoints.length > 0) {
                          models = checkPoints;
                        }
                      }
                    } catch (e) {
                      // ComfyUI might not be running, provide standard checkpoints
                    }
                    if (models.length === 0) {
                      models = [
                        'flux1-dev.safetensors',
                        'flux1-schnell.safetensors',
                        'sd_xl_base_1.0.safetensors',
                        'sd3.5_large.safetensors',
                        'qwen_image.safetensors',
                        'hunyuan_image_2.1.safetensors',
                        'v1-5-pruned-emaonly.safetensors',
                      ];
                    }
                    break;
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, models }));
                return;
              }

              if (mediaType === 'video') {
                switch (provider) {
                  case 'google':
                    models = [
                      'veo-3.1-generate-preview',
                      'veo-3.1-lite-generate-preview',
                      'veo-2.0-generate-001',
                    ];
                    break;

                  case 'openai':
                    if (apiKey) {
                      try {
                        const resp = await fetch('https://api.openai.com/v1/models', {
                          headers: { Authorization: `Bearer ${apiKey}` },
                          signal: AbortSignal.timeout(5000),
                        });
                        if (resp.ok) {
                          const data = await resp.json();
                          const found = (data.data || [])
                            .map((m: any) => m.id)
                            .filter((id: string) => id.includes('sora'));
                          if (found.length > 0) models = found;
                        }
                      } catch (e) {}
                    }
                    if (models.length === 0) {
                      models = ['sora-2', 'sora-2-pro'];
                    }
                    break;

                  case 'openrouter': {
                    const resp = await fetch('https://openrouter.ai/api/v1/models');
                    if (resp.ok) {
                      const data = await resp.json();
                      models = (data.data || [])
                        .map((m: any) => m.id)
                        .filter((id: string) => 
                          id.includes('luma') || 
                          id.includes('kling') || 
                          id.includes('video') || 
                          id.includes('runway') ||
                          id.includes('minimax')
                        );
                    }
                    if (models.length === 0) {
                      models = [
                        'luma/dream-machine',
                        'kling/kling-v1.5',
                        'minimax/video-01',
                      ];
                    }
                    break;
                  }

                  case 'comfyui': {
                    const target = comfyUiUrl || 'http://localhost:8188';
                    try {
                      const resp = await fetch(`${target}/object_info/CheckpointLoaderSimple`, { signal: AbortSignal.timeout(2000) });
                      if (resp.ok) {
                        const data = await resp.json();
                        const checkPoints = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
                        if (Array.isArray(checkPoints) && checkPoints.length > 0) {
                          models = checkPoints.filter((c: string) => 
                            c.includes('wan') || 
                            c.includes('hunyuan') || 
                            c.includes('cog') || 
                            c.includes('svd') || 
                            c.includes('video')
                          );
                        }
                      }
                    } catch (e) {}

                    if (models.length === 0) {
                      models = [
                        'wan2.1_t2v_14B.safetensors',
                        'wan2.1_t2v_1.3B.safetensors',
                        'hunyuan_video_720_cfgdistill_bf16.safetensors',
                        'ltx-video-2b-v0.9.safetensors',
                        'cogvideox_5b.safetensors',
                        'mochi_preview.safetensors',
                        'svd_xt.safetensors',
                        'animatediff_v3.safetensors',
                      ];
                    }
                    break;
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, models }));
                return;
              }

              // Handle LLM (TEXT) model fetching
              switch (provider) {
                case 'gemini': {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                  const resp = await fetch(url);
                  if (!resp.ok) throw new Error(`Gemini API returned ${resp.status}: ${await resp.text()}`);
                  const data = await resp.json();
                  models = (data.models || [])
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => m.name.replace(/^models\//, ''));
                  break;
                }

                case 'anthropic': {
                  const url = 'https://api.anthropic.com/v1/models';
                  const resp = await fetch(url, {
                    headers: {
                      'x-api-key': apiKey || '',
                      'anthropic-version': '2023-06-01',
                    },
                  });
                  if (!resp.ok) throw new Error(`Anthropic API returned ${resp.status}: ${await resp.text()}`);
                  const data = await resp.json();
                  models = (data.data || []).map((m: any) => m.id);
                  break;
                }

                case 'ollama': {
                  const targetUrl = `${ollamaUrl || 'http://localhost:11434'}/api/tags`;
                  const resp = await fetch(targetUrl);
                  if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
                  const data = await resp.json();
                  models = (data.models || []).map((m: any) => m.name);
                  break;
                }

                case 'huggingface': {
                  const url = 'https://huggingface.co/api/models?filter=text-generation&sort=downloads&limit=50';
                  const headers: Record<string, string> = {};
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
                  const resp = await fetch(url, { headers });
                  if (!resp.ok) throw new Error(`HuggingFace API returned ${resp.status}`);
                  const data = await resp.json();
                  models = (data || []).map((m: any) => m.id);
                  break;
                }

                // OpenAI-compatible /v1/models providers
                default: {
                  let targetBase = baseUrl;
                  if (!targetBase) {
                    if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                    else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                    else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                    else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                    else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                    else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                    else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                    else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                    else if (provider === 'lmstudio') targetBase = lmStudioUrl || 'http://localhost:1234/v1';
                    else if (provider === 'xiaomi_mimo') targetBase = 'https://api.mimo.xiaomi.com/v1';
                  }

                  const targetUrl = targetBase?.endsWith('/models') ? targetBase : `${targetBase?.replace(/\/+$/, '')}/models`;
                  const headers: Record<string, string> = {};
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, { headers });
                  if (!resp.ok) throw new Error(`${provider} returned ${resp.status}: ${await resp.text()}`);
                  const data = await resp.json();
                  models = (data.data || []).map((m: any) => m.id);
                  break;
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, models }));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        res.statusCode = 404;
        res.end();
      });

      // 1. Search Web / DDG
      server.middlewares.use('/api/search', async (req, res) => {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const { query, provider, apiKey } = body;
          const results = await searchWeb(query || '', provider, apiKey);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, results }));
          return;
        }
        res.statusCode = 405; res.end();
      });

      // 2. Scrape Web URL
      server.middlewares.use('/api/scrape', async (req, res) => {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const data = await scrapeUrl(body.url || '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...data }));
          return;
        }
        res.statusCode = 405; res.end();
      });

      // 3. YouTube Video Extraction
      server.middlewares.use('/api/youtube', async (req, res) => {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const data = await extractYoutube(body.url || '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...data }));
          return;
        }
        res.statusCode = 405; res.end();
      });

      // 4. PDF Parsing
      server.middlewares.use('/api/parse-pdf', async (req, res) => {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const data = await parsePdf(body.base64 || '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...data }));
          return;
        }
        res.statusCode = 405; res.end();
      });

      // 5. Grounded RAG Chat
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const { provider, apiKey, baseUrl, model, messages, sources, chatStyle } = body;
            const lastMessage = messages?.[messages.length - 1]?.content || '';
            let responseText = '';
            let citations: any[] = [];
            let providerNotice = '';

            // Normalize effective model per provider
            let effectiveModel = model;
            if (provider === 'deepseek') {
              if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) {
                effectiveModel = 'deepseek-chat';
              }
            } else if (provider === 'openai') {
              if (!effectiveModel || (!effectiveModel.startsWith('gpt') && !effectiveModel.startsWith('o1') && !effectiveModel.startsWith('o3') && !effectiveModel.startsWith('chatgpt'))) {
                effectiveModel = 'gpt-4o';
              }
            } else if (provider === 'groq') {
              if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
            } else if (provider === 'ollama') {
              if (!effectiveModel) effectiveModel = 'llama3';
            } else if (provider === 'anthropic') {
              if (!effectiveModel) effectiveModel = 'claude-3-7-sonnet-20250219';
            } else if (provider === 'gemini') {
              if (!effectiveModel || effectiveModel.includes('3.8')) effectiveModel = 'gemini-2.5-flash';
            }

            const hasLocalEndpoint = provider === 'ollama' || provider === 'lmstudio';

            if (!apiKey && !hasLocalEndpoint) {
              const providerNames: Record<string, string> = {
                deepseek: 'DeepSeek',
                openai: 'OpenAI',
                anthropic: 'Anthropic Claude',
                gemini: 'Google Gemini',
                groq: 'Groq',
                grok: 'xAI Grok',
                openrouter: 'OpenRouter',
              };
              const pName = providerNames[provider] || (provider ? String(provider).toUpperCase() : 'AI');
              providerNotice = `> [!NOTE]\n> **${pName} API Key Required:** You selected **${pName}** (${effectiveModel || 'Default Model'}), but no API key is configured yet in **Settings > AI Models**. Using grounded local notebook synthesis below:\n\n`;
            } else if (apiKey || hasLocalEndpoint) {
              try {
                if (provider === 'gemini') {
                  const { systemPrompt } = buildRagPrompt(sources || [], lastMessage, chatStyle);
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: (messages || []).map((m: any) => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }],
                      })),
                      systemInstruction: { parts: [{ text: systemPrompt }] },
                      generationConfig: {
                        maxOutputTokens: chatStyle === 'Concise' ? 512 : (chatStyle === 'Detailed' ? 3000 : 1200),
                      },
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  } else if (resp.status === 404) {
                    // Fallback to gemini-1.5-flash if model name was unrecognized
                    const fbUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                    const fbResp = await fetch(fbUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: (messages || []).map((m: any) => ({
                          role: m.role === 'user' ? 'user' : 'model',
                          parts: [{ text: m.content }],
                        })),
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        generationConfig: {
                          maxOutputTokens: chatStyle === 'Concise' ? 512 : (chatStyle === 'Detailed' ? 3000 : 1200),
                        },
                      }),
                      signal: AbortSignal.timeout(60000),
                    });
                    if (fbResp.ok) {
                      const fbData = await fbResp.json();
                      responseText = fbData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    } else {
                      const errText = await fbResp.text();
                      providerNotice = `> [!WARNING]\n> **Gemini API Error (${fbResp.status}):** ${errText}\n\n`;
                    }
                  } else {
                    const errText = await resp.text();
                    let errMsg = errText;
                    try {
                      const j = JSON.parse(errText);
                      errMsg = j.error?.message || errText;
                    } catch (_) {}
                    providerNotice = `> [!WARNING]\n> **Gemini API Error (${resp.status}):** ${errMsg}\n\n`;
                  }
                } else if (provider === 'anthropic') {
                  const { systemPrompt } = buildRagPrompt(sources || [], lastMessage, chatStyle);
                  const resp = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'x-api-key': apiKey,
                      'anthropic-version': '2023-06-01',
                      'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: effectiveModel,
                      system: systemPrompt,
                      messages: (messages || []).map((m: any) => ({ role: m.role, content: m.content })),
                      max_tokens: chatStyle === 'Concise' ? 512 : (chatStyle === 'Detailed' ? 3000 : 1200),
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    responseText = data.content?.[0]?.text || '';
                  } else {
                    const errText = await resp.text();
                    let errMsg = errText;
                    try {
                      const j = JSON.parse(errText);
                      errMsg = j.error?.message || errText;
                    } catch (_) {}
                    providerNotice = `> [!WARNING]\n> **Anthropic Claude Error (${resp.status}):** ${errMsg}\n\n`;
                  }
                } else {
                  // OpenAI-compatible endpoint (Groq, OpenAI, DeepSeek, Ollama, LM Studio, etc.)
                  const { systemPrompt } = buildRagPrompt(sources || [], lastMessage, chatStyle);
                  let targetBase = baseUrl;
                  if (!targetBase) {
                    if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                    else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                    else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                    else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                    else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                    else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                    else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                    else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                    else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                    else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                  }
                  const targetUrl = `${targetBase?.replace(/\/+$/, '')}/chat/completions`;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [
                        { role: 'system', content: systemPrompt },
                        ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
                      ],
                      max_tokens: chatStyle === 'Concise' ? 512 : (chatStyle === 'Detailed' ? 3000 : 1200),
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const choice = data.choices?.[0]?.message;
                    responseText = choice?.content || choice?.reasoning_content || '';
                  } else {
                    const errText = await resp.text();
                    let errMsg = errText;
                    try {
                      const j = JSON.parse(errText);
                      errMsg = j.error?.message || j.message || errText;
                    } catch (_) {}
                    const pTitle = provider === 'deepseek' ? 'DeepSeek' : (provider ? String(provider).toUpperCase() : 'Provider');
                    if (resp.status === 401) {
                      providerNotice = `> [!WARNING]\n> **${pTitle} Authentication Error (401):** The provided API key is invalid or unauthorized. Please verify your API key in **Settings > AI Models**.\n\n`;
                    } else if (resp.status === 402) {
                      providerNotice = `> [!WARNING]\n> **${pTitle} Balance Error (402):** Insufficient balance or credits in your account. Please check your billing at the provider dashboard.\n\n`;
                    } else if (resp.status === 429) {
                      providerNotice = `> [!WARNING]\n> **${pTitle} Rate Limit (429):** Too many requests. Please wait a moment before trying again.\n\n`;
                    } else {
                      providerNotice = `> [!WARNING]\n> **${pTitle} API Error (${resp.status}):** ${errMsg}\n\n`;
                    }
                  }
                }
              } catch (e: any) {
                console.error('Provider call error:', e);
                const pTitle = provider ? String(provider).toUpperCase() : 'AI Provider';
                providerNotice = `> [!WARNING]\n> **${pTitle} Connection Error:** ${e.message || 'Request failed or timed out.'}\n\n`;
              }
            }

            // Fallback to grounded conversational local synthesizer if API not provided or failed
            if (!responseText) {
              const localResult = synthesizeLocalResponse(lastMessage, sources || [], chatStyle);
              responseText = (providerNotice ? providerNotice : '') + localResult.text;
              citations = localResult.citations;
            } else {
              // Extract citation markers
              (sources || []).forEach((s: any, idx: number) => {
                if (responseText.includes(`[${idx + 1}]`)) {
                  citations.push({
                    id: `cit-${idx + 1}`,
                    sourceId: s.id,
                    sourceTitle: s.title,
                    excerpt: cleanSourceContent(s.content).slice(0, 180) + '...',
                  });
                }
              });
              if (citations.length === 0 && (sources || []).length > 0) {
                citations = (sources || []).slice(0, 2).map((s: any, idx: number) => ({
                  id: `cit-${idx + 1}`,
                  sourceId: s.id,
                  sourceTitle: s.title,
                  excerpt: cleanSourceContent(s.content).slice(0, 180) + '...',
                }));
              }
            }

            // Guarantee non-empty text
            if (!responseText.trim()) {
              responseText = 'No response could be generated from the selected provider or notebook sources. Please check your Settings or try a different query.';
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, text: responseText, citations }));
            return;
          } catch (err: any) {
            console.error('API /api/chat error:', err);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message, text: `Server error: ${err.message}` }));
            return;
          }
        }
        res.statusCode = 405; res.end();
      });

      // 6. Generate Studio Artifact
      server.middlewares.use('/api/generate-artifact', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const {
              type, sources, language, topic, quizConfig, flashcardConfig, reportConfig, infographicConfig,
              audioConfig, slideConfig, videoConfig,
              provider, apiKey, baseUrl, model,
              imageProvider, imageApiKey, imageModel, imageBaseUrl, imageComfyUiUrl
            } = body;

            // If mindmap and an LLM is available, generate an intelligent custom mind map
            if (type === 'mindmap' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 3500)}`
                ).join('\n\n---\n\n');

                const prompt = `You are an expert knowledge-graph mind map generator, exactly like Google NotebookLM.
Analyze the provided sources and generate a multi-tier, hierarchical Mind Map in JSON based on the user's requested topic: "${topic || 'Core Themes and Insights'}".

CRITICAL RULES (NOTEBOOKLM FORMAT):
1. TITLES MUST BE SHORT PHRASES (2 to 5 words maximum)!
   - NEVER write sentences, questions, or long paragraphs in any "title".
   - Examples of EXCELLENT titles:
     - "Fusion Energy (CFS)"
     - "HTS Magnet R&D"
     - "SPARC Tokamak"
     - "ARC Pilot Plant"
     - "English & History"
     - "Major Somnath Sharma (PVC)"
     - "Battle of Badgam"
     - "Language Skills"
     - "Prepositions of Time/Place"
     - "Descriptive Paragraph Writing"
   - BAD titles (DO NOT USE):
     - "The Navier-Stokes equations model momentum balance and mass conservation"
     - "Whether smooth solutions always exist in three dimensions"
2. MULTI-TIER HIERARCHY & DEPTH:
   - Level 0 (Root): Short title (2-4 words, e.g. "${topic ? topic.slice(0, 35) : 'Consolidated Sources'}")
   - Level 1 (Major Themes): 2 to 4 primary branches (2-4 words each)
   - Level 2 (Subtopics): 2 to 4 focused topics under each primary branch (2-5 words each)
   - Level 3 (Deep Concepts/Details): 2 to 4 crisp concept leaves (2-5 words each)
3. OPTIONAL SUMMARY:
   - Provide a short 1-sentence "summary" with citation like [1] for tooltip/detail inspector, but the "title" MUST remain a clean 2-5 word phrase.

INGESTED SOURCE DOCUMENTS:
${cleanedSources}

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown ticks, no preamble) matching this schema:
{
  "title": "Short Main Title (2-4 words)",
  "description": "Short 1-sentence scope overview",
  "children": [
    {
      "title": "Major Branch 1",
      "summary": "1-sentence summary [1]",
      "children": [
        {
          "title": "Subtopic 1.1",
          "summary": "1-sentence summary [1]",
          "children": [
            { "title": "Concept 1.1.1", "summary": "1-sentence summary [1]" },
            { "title": "Concept 1.1.2", "summary": "1-sentence summary [2]" }
          ]
        },
        {
          "title": "Subtopic 1.2",
          "summary": "1-sentence summary [2]",
          "children": [
            { "title": "Concept 1.2.1", "summary": "1-sentence summary [1]" }
          ]
        }
      ]
    },
    {
      "title": "Major Branch 2",
      "summary": "1-sentence summary [2]",
      "children": [
        {
          "title": "Subtopic 2.1",
          "summary": "1-sentence summary [2]",
          "children": [
            { "title": "Concept 2.1.1", "summary": "1-sentence summary [2]" },
            { "title": "Concept 2.1.2", "summary": "1-sentence summary [3]" }
          ]
        }
      ]
    }
  ]
}`;

                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json' },
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      const jsonMatch = text.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { mindMap: parsed } }));
                        return;
                      }
                    }
                  }
                } else if (targetBase) {
                  const targetUrl = `${targetBase.replace(/\/+$/, '')}/chat/completions`;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [{ role: 'user', content: prompt }],
                      temperature: 0.2,
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const text = data.choices?.[0]?.message?.content;
                    if (text) {
                      const jsonMatch = text.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { mindMap: parsed } }));
                        return;
                      }
                    }
                  }
                }
              } catch (err) {
                console.error('LLM mindmap generation failed, using local grounded generator:', err);
              }
            }

            // If quiz and an LLM is available, generate an intelligent multi-type quiz
            if (type === 'quiz' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                  else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                  else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                  else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 3500)}`
                ).join('\n\n---\n\n');

                const countMap: Record<string, number> = { fewer: 10, standard: 15, more: 25 };
                const targetNum = countMap[quizConfig?.questionCount || 'standard'] || 15;
                const targetDifficulty = quizConfig?.difficulty || 'medium';
                const targetTypes = (quizConfig?.questionTypes && quizConfig.questionTypes.length > 0)
                  ? quizConfig.questionTypes
                  : ['fill_blank', 'multiple_choice', 'multiple_select', 'short_answer'];

                // Helper to shuffle quiz options so option A is never predictable
                const shuffleQuizQuestions = (questions: any[]): any[] => {
                  if (!Array.isArray(questions)) return [];
                  return questions.map((q) => {
                    if (!q) return q;
                    // Multiple Choice: shuffle options and track new index of correct answer
                    if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 1) {
                      const origIdx = typeof q.correct === 'number' ? q.correct : 0;
                      const correctVal = q.options[origIdx];
                      const shuffled = [...q.options];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }
                      const newIdx = shuffled.indexOf(correctVal);
                      return {
                        ...q,
                        options: shuffled,
                        correct: newIdx >= 0 ? newIdx : Math.floor(Math.random() * shuffled.length),
                      };
                    }

                    // Multiple Select: shuffle options and track new indices of correct answers
                    if (q.type === 'multiple_select' && Array.isArray(q.options) && q.options.length > 1) {
                      const origList: number[] = q.correctAnswers || (Array.isArray(q.correct) ? q.correct : [q.correct]);
                      const correctVals = origList.map((idx: number) => q.options[idx]).filter(Boolean);
                      const shuffled = [...q.options];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }
                      const newList = correctVals.map((val: string) => shuffled.indexOf(val)).filter((idx: number) => idx >= 0);
                      return {
                        ...q,
                        options: shuffled,
                        correctAnswers: newList,
                      };
                    }

                    return q;
                  });
                };

                // Helper to safely parse quiz JSON even if LLM slightly truncates or has trailing token errors
                const parseQuizJsonSafe = (rawText: string): any => {
                  if (!rawText) return null;
                  const clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                  // 1. Direct match and parse
                  const jsonMatch = clean.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    try {
                      const parsed = JSON.parse(jsonMatch[0]);
                      if (parsed?.quiz && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
                        return parsed;
                      }
                    } catch {}
                  }

                  // 2. Resilient object-by-object extractor if JSON has a trailing truncation or syntax glitch
                  const quizIdx = clean.indexOf('"quiz"');
                  if (quizIdx !== -1) {
                    const arrayStart = clean.indexOf('[', quizIdx);
                    if (arrayStart !== -1) {
                      const questions: any[] = [];
                      let depth = 0;
                      let start = -1;
                      let inString = false;
                      let escape = false;

                      for (let i = arrayStart + 1; i < clean.length; i++) {
                        const char = clean[i];
                        if (escape) {
                          escape = false;
                          continue;
                        }
                        if (char === '\\') {
                          escape = true;
                          continue;
                        }
                        if (char === '"') {
                          inString = !inString;
                          continue;
                        }
                        if (!inString) {
                          if (char === '{') {
                            if (depth === 0) start = i;
                            depth++;
                          } else if (char === '}') {
                            depth--;
                            if (depth === 0 && start !== -1) {
                              const objStr = clean.slice(start, i + 1);
                              try {
                                const q = JSON.parse(objStr);
                                if (q && (q.question || q.type)) {
                                  questions.push(q);
                                }
                              } catch {}
                              start = -1;
                            }
                          }
                        }
                      }

                      if (questions.length > 0) {
                        return { quiz: questions };
                      }
                    }
                  }
                  return null;
                };

                const prompt = `You are an educational assessment expert, exactly like Google NotebookLM's Quiz Generator.
Create a comprehensive grounded Quiz based strictly on the provided sources.

QUIZ CONFIGURATION:
- Focus Topic: "${topic || 'Core Themes and Critical Insights'}"
- Difficulty Level: "${targetDifficulty}"
- EXACT Number of Questions: ${targetNum} (CRITICAL: You MUST provide all ${targetNum} complete questions in the "quiz" array. Do not stop early or truncate.)
- Allowed Question Types: ${targetTypes.join(', ')}

CRITICAL RULES:
1. You MUST generate EXACTLY ${targetNum} questions in the "quiz" array.
2. Distribute questions evenly across the requested question types: ${targetTypes.join(', ')}.
3. Every question must be directly grounded in facts, concepts, and evidence from the ingested sources.
4. QUESTION TYPE FORMATS:
   - "multiple_choice": Standard 4 options. "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correct": integer index (0, 1, 2, or 3).
     CRITICAL: RANDOMLY ROTATE the correct answer among options A (0), B (1), C (2), and D (3). Do NOT put the correct answer at index 0 (A) on every question!
   - "fill_blank": A sentence with "______" indicating the blank. "blankAnswer": "exactWord", "acceptableAnswers": ["exactWord", "alternative"].
   - "multiple_select": Question specifies "(Select all that apply)". "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correctAnswers": [0, 2] (array of integer indices).
   - "short_answer": Conceptual open-ended question. "modelAnswer": "1-2 sentence model response [1]", "keyPoints": ["Core concept 1", "Core concept 2"].
5. Provide a clear "explanation" in every question referencing exact facts or citations like [1].

INGESTED SOURCE DOCUMENTS:
${cleanedSources}

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown ticks, no preamble) matching this schema:
{
  "quiz": [
    {
      "type": "multiple_choice",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 2,
      "explanation": "..."
    }
  ]
}`;

                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      const parsed = parseQuizJsonSafe(text);
                      if (parsed?.quiz && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
                        const shuffledQuiz = shuffleQuizQuestions(parsed.quiz);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { quiz: shuffledQuiz, difficulty: targetDifficulty } }));
                        return;
                      }
                    }
                  } else {
                    const errBody = await resp.text();
                    console.error('Gemini quiz error:', resp.status, errBody);
                  }
                } else if (targetBase) {
                  const targetUrl = `${targetBase.replace(/\/+$/, '')}/chat/completions`;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [{ role: 'user', content: prompt }],
                      max_tokens: 8192,
                      temperature: 0.3,
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const choice = data.choices?.[0]?.message;
                    const text = choice?.content || choice?.reasoning_content;
                    if (text) {
                      const parsed = parseQuizJsonSafe(text);
                      if (parsed?.quiz && Array.isArray(parsed.quiz) && parsed.quiz.length > 0) {
                        const shuffledQuiz = shuffleQuizQuestions(parsed.quiz);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { quiz: shuffledQuiz, difficulty: targetDifficulty } }));
                        return;
                      }
                    }
                  } else {
                    const errBody = await resp.text();
                    console.error('LLM quiz API error:', resp.status, errBody);
                  }
                }
              } catch (err) {
                console.error('LLM quiz generation failed, using local grounded generator:', err);
              }
            }

            // If flashcards and an LLM is available, generate an intelligent source-scaled flashcard deck
            if (type === 'flashcards' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                  else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                  else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                  else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 4000)}`
                ).join('\n\n---\n\n');

                const totalSourceChars = (sources || []).reduce((acc: number, s: any) => acc + (s.content ? String(s.content).length : 0), 0);
                const volume = flashcardConfig?.cardVolume || 'auto';
                let targetCardCount = 20;

                if (volume === 'fewer') {
                  targetCardCount = 12;
                } else if (volume === 'standard') {
                  targetCardCount = 20;
                } else if (volume === 'extensive') {
                  targetCardCount = Math.min(50, Math.max(35, Math.round(totalSourceChars / 350)));
                } else {
                  // Auto mode: dynamic scaling based on source length and depth (NotebookLM style)
                  if (totalSourceChars < 3000) {
                    targetCardCount = 15;
                  } else if (totalSourceChars < 9000) {
                    targetCardCount = 25;
                  } else if (totalSourceChars < 25000) {
                    targetCardCount = 38;
                  } else {
                    targetCardCount = 50;
                  }
                }

                const focusMode = flashcardConfig?.focus || 'all';
                let focusInstruction = 'Cover all foundational concepts, terminology, causal mechanisms, and evidence.';
                if (focusMode === 'key_terms') {
                  focusInstruction = 'Prioritize critical definitions, domain-specific terminology, and core formulas/principles.';
                } else if (focusMode === 'qa_conceptual') {
                  focusInstruction = 'Prioritize deep analytical questions, causal chains, counter-arguments, and synthesis of concepts.';
                }

                // Helper to safely parse flashcards JSON even if LLM slightly truncates
                const parseFlashcardsJsonSafe = (rawText: string): any => {
                  if (!rawText) return null;
                  const clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                  const jsonMatch = clean.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    try {
                      const parsed = JSON.parse(jsonMatch[0]);
                      if (parsed?.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
                        return parsed;
                      }
                    } catch {}
                  }

                  const fcIdx = clean.indexOf('"flashcards"');
                  if (fcIdx !== -1) {
                    const arrayStart = clean.indexOf('[', fcIdx);
                    if (arrayStart !== -1) {
                      const cards: any[] = [];
                      let depth = 0;
                      let start = -1;
                      let inString = false;
                      let escape = false;

                      for (let i = arrayStart + 1; i < clean.length; i++) {
                        const char = clean[i];
                        if (escape) { escape = false; continue; }
                        if (char === '\\') { escape = true; continue; }
                        if (char === '"') { inString = !inString; continue; }
                        if (!inString) {
                          if (char === '{') {
                            if (depth === 0) start = i;
                            depth++;
                          } else if (char === '}') {
                            depth--;
                            if (depth === 0 && start !== -1) {
                              const objStr = clean.slice(start, i + 1);
                              try {
                                const c = JSON.parse(objStr);
                                if (c && (c.q || c.question) && (c.a || c.answer)) {
                                  cards.push({
                                    q: c.q || c.question,
                                    a: c.a || c.answer,
                                    category: c.category || 'Core Concept',
                                    sourceTitle: c.sourceTitle || (sources?.[0]?.title || 'Source Material'),
                                  });
                                }
                              } catch {}
                              start = -1;
                            }
                          }
                        }
                      }

                      if (cards.length > 0) {
                        return { flashcards: cards };
                      }
                    }
                  }
                  return null;
                };

                const prompt = `You are an expert cognitive learning and flashcard specialist, exactly like Google NotebookLM.
Analyze the provided sources and generate a comprehensive, high-yield deck of Flashcards in JSON based on: "${topic || 'Key Concepts and Core Insights'}".

FLASHCARD CONFIGURATION:
- User Provided Sources: ${sources?.length || 0} source documents (total content depth: ~${totalSourceChars} characters)
- TARGET COUNT: EXACTLY ${targetCardCount} flashcards. (CRITICAL: You MUST provide all ${targetCardCount} distinct, high-quality cards in the "flashcards" array. Do NOT stop early!)
- Focus Mode: ${focusInstruction}

CRITICAL RULES (NOTEBOOKLM FORMAT):
1. Every card must be directly grounded in specific facts, definitions, or insights from the ingested sources.
2. "q" (Front / Prompt):
   - Crisp, thought-provoking prompt, question, or key concept (1-2 sentences).
   - Test understanding, definitions, causal mechanisms, key distinctions, or significant figures/events.
   - Examples:
     - "What is the primary role of High-Temperature Superconductors (HTS) in the SPARC tokamak?"
     - "How does the principle of Superposition differ from Quantum Entanglement?"
     - "Define 'Opportunity Cost' in the context of capital allocation."
3. "a" (Back / Answer):
   - Direct, authoritative, high-density answer (1-3 sentences).
   - Include specific numbers, facts, and cite the source like [1] or [2].
4. "category":
   - 1-3 word tag (e.g. "Core Concept", "Definition", "Mechanism", "History", "Formula").
5. "sourceTitle":
   - Title of the source document this card is synthesized from.

INGESTED SOURCE DOCUMENTS:
${cleanedSources}

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown ticks, no preamble) matching this schema:
{
  "flashcards": [
    {
      "q": "What is ...?",
      "a": "It is ... [1]",
      "category": "Core Principle",
      "sourceTitle": "..."
    }
  ]
}`;

                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      const parsed = parseFlashcardsJsonSafe(text);
                      if (parsed?.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { flashcards: parsed.flashcards } }));
                        return;
                      }
                    }
                  } else {
                    const errBody = await resp.text();
                    console.error('Gemini flashcard error:', resp.status, errBody);
                  }
                } else if (targetBase) {
                  const targetUrl = `${targetBase.replace(/\/+$/, '')}/chat/completions`;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [{ role: 'user', content: prompt }],
                      max_tokens: 8192,
                      temperature: 0.25,
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const choice = data.choices?.[0]?.message;
                    const text = choice?.content || choice?.reasoning_content;
                    if (text) {
                      const parsed = parseFlashcardsJsonSafe(text);
                      if (parsed?.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, data: { flashcards: parsed.flashcards } }));
                        return;
                      }
                    }
                  } else {
                    const errBody = await resp.text();
                    console.error('LLM flashcards API error:', resp.status, errBody);
                  }
                }
              } catch (err) {
                console.error('LLM flashcard generation failed, using local grounded generator:', err);
              }
            }

            // If report and an LLM is available, generate an intelligent, grounded NotebookLM report
            if (type === 'report' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                  else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                  else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                  else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 5000)}`
                ).join('\n\n---\n\n');

                const targetFormat = reportConfig?.format || 'briefing';
                const targetDepth = reportConfig?.depth || 'standard';

                let wordGuideline = '1,400 to 2,000 words. Provide balanced depth, thorough explanations, and detailed analysis.';
                if (targetDepth === 'concise') {
                  wordGuideline = '600 to 900 words. Provide a high-density, crisp executive briefing with immediate takeaways.';
                } else if (targetDepth === 'extensive') {
                  wordGuideline = '2,500 to 3,500+ words. Provide an exhaustive, multi-pillar comprehensive research dossier with in-depth evidence citations and structural breakdowns.';
                }

                let formatTemplate = '';
                if (targetFormat === 'briefing') {
                  formatTemplate = `FORMAT: Executive Briefing Doc
Structure:
# Executive Briefing: [Compelling title based on sources & topic]
> [!NOTE]
> **Executive Summary:** High-impact synthesis of the most critical facts, conclusions, and operational takeaways.

## 1. Context & Operational Background
Establish background, history, and current state directly citing the source documents [1], [2].

## 2. Key Empirical Findings & Evidence
Detailed analysis of core claims, metrics, and observations extracted from the sources.

## 3. Strategic Implications & Risk Considerations
Examine the second-order effects, trade-offs, potential vulnerabilities, and systemic implications.

## 4. Actionable Next Steps & Recommendations
Provide prioritized, concrete recommendations grounded in the source findings.

## Sources Cited
Numbered list of cited sources with their titles and key contributions.`;
                } else if (targetFormat === 'study_guide') {
                  formatTemplate = `FORMAT: Comprehensive Study Guide
Structure:
# Comprehensive Study Guide: [Title]
> [!TIP]
> **Study Overview:** High-level conceptual map of the subject matter and learning objectives.

## 1. Key Concepts & Definitions (Glossary)
Alphabetical or thematic glossary of key terminology, foundational formulas, or core theories with crisp definitions and citations [1].

## 2. Thematic Deep Dives & Conceptual Explanations
Detailed analysis of primary topics, mechanisms, and relationships described across the texts.

## 3. Review & Self-Assessment Questions
6 to 10 targeted review questions testing comprehension, application, and nuance. Provide clear, authoritative answers and explanations beneath each question.

## 4. Critical Thinking & Essay Prompts
Thought-provoking prompts for deeper synthesis or examinations.

## Sources Cited`;
                } else if (targetFormat === 'faq') {
                  formatTemplate = `FORMAT: Frequently Asked Questions (FAQ)
Structure:
# Frequently Asked Questions (FAQ): [Title]
> [!NOTE]
> **Document Purpose:** Answering the most essential inquiries, nuances, common misconceptions, and operational mechanics from the source material.

Organize the FAQ into 3-4 logical thematic sections.
For each question:
### Q: [Clear inquiry]
**Answer:** Authoritative, high-density grounded explanation citing the sources [1], [2].

## Sources Cited`;
                } else if (targetFormat === 'timeline') {
                  formatTemplate = `FORMAT: Chronological Analysis & Timeline
Structure:
# Chronological Analysis & Timeline: [Title]
> [!NOTE]
> **Temporal Synthesis:** Evolutionary progression, pivotal milestones, and turning points.

## 1. Contextual Foundations & Origins
Early background and pre-conditions.

## 2. Chronological Milestones & Event Log
Markdown table or structured chronological sequence detailing dates/phases, events, key figures/documents, and significance with citations [1].

## 3. Evolutionary Dynamics & Inflection Points
Analysis of what shifted between phases and why.

## 4. Current State & Forward Trajectory

## Sources Cited`;
                } else if (targetFormat === 'critique') {
                  formatTemplate = `FORMAT: Critical Review & Analysis
Structure:
# Critical Review & Analysis: [Title]
> [!IMPORTANT]
> **Analytical Thesis:** Objective critical assessment of core arguments, methodology, and evidentiary validity.

## 1. Central Arguments & Theoretical Framework
Clear exposition of claims made in the source material [1].

## 2. Methodological & Evidentiary Strengths
What is rigorous, well-supported, and compelling.

## 3. Critical Vulnerabilities, Gaps & Counter-Perspectives
Where evidence is thin, assumptions questionable, or alternative explanations exist.

## 4. Comparative Synthesis & Scholarly Verdict
Balanced reconciliation of conflicting views.

## Sources Cited`;
                } else if (targetFormat === 'blog_post') {
                  formatTemplate = `FORMAT: Publication-Ready Blog Post
Structure:
# [Engaging, Catchy Blog Post Title grounded in sources]
> **Hook / Core Takeaway:** A compelling lead that synthesizes the most significant insight.

## Introduction: Why This Matters Now
Establish the context with punchy, high-readability narrative grounded in the sources [1].

## The Big Picture: Core Discoveries & Breakthroughs
Break down the main insights with subheadings, bullet points, and real quotes.

## Key Nuances & Surprising Realities
Address nuances, misconceptions, or unexpected findings documented in the sources.

## Actionable Takeaways for Practitioners & Observers
Practical lessons, strategic predictions, or next steps.

## Sources Cited
Numbered list of cited sources.`;
                } else if (targetFormat === 'create_your_own') {
                  formatTemplate = `FORMAT: Custom User-Defined Report
SPECIFIC USER INSTRUCTIONS:
${reportConfig?.customPrompt || 'Create a comprehensive, well-structured report synthesizing the provided sources.'}

CRITICAL: Follow the user's instructions rigorously while grounding every fact and claim with source citations [1], [2].`;
                } else {
                  // Custom suggestion format (e.g. Technology Roadmap, Investment Case Analysis, Concept Breakdown, etc.)
                  const displayTitle = reportConfig?.formatTitle || targetFormat;
                  formatTemplate = `FORMAT: ${displayTitle}
SPECIFIC GUIDANCE:
${reportConfig?.customPrompt || `Synthesize the provided sources focusing on ${displayTitle}. Include structured analytical sections, evidence citations [1], [2], and strategic insights.`}

Structure:
# ${displayTitle}: [Grounded Subtitle]
> [!NOTE]
> **Executive Summary:** High-impact synthesis of the core theme and primary findings.

## 1. Strategic Context & Framework
## 2. In-Depth Evaluation & Core Mechanics
## 3. Evidence, Trade-offs & Operational Impact
## 4. Strategic Outlook & Actionable Recommendations

## Sources Cited`;
                }

                const prompt = `You are a world-class principal research analyst, exactly like Google NotebookLM's Report & Synthesis Engine.
Synthesize the provided source documents into a meticulous, publication-grade Report in GitHub-flavored Markdown.

REPORT CONFIGURATION:
- Requested Format: ${targetFormat.toUpperCase()}
- Focus / Custom Topic: "${topic || 'Comprehensive Synthesis of Ingested Sources'}"
- Target Length: ${wordGuideline}
- Language: ${language || 'English'}

${formatTemplate}

CRITICAL RULES:
1. Grounding: Every statement, claim, and statistic must be strictly grounded in the ingested sources. Do NOT invent facts or hallucinate citations.
2. Citation Format: Include numerical inline citations referencing the source documents, such as [1], [2], etc., matching the [Source X] numbering below.
3. Typography & Structure: Use clear Markdown formatting with headers (#, ##, ###), bold text, bullet points, numbered lists, blockquotes, and tables where applicable.
4. LaTeX Math & Formulas: Whenever mathematical, physical, scientific, or quantitative expressions appear (e.g. magnetic fields $B_0$, fusion gain $Q \ge 2$, energy relationships $E = mc^2$, normalized beta $\beta_N$, critical current density $J_c$, financial/statistical formulas, integrals, fractions, etc.), rigorously format them using standard LaTeX syntax: single dollar signs \`$...$\` for inline math and double dollar signs \`$$...$$\` on isolated lines for display formulas.
5. Output Requirement: Output PURE Markdown directly (start immediately with '# ...'). Do NOT wrap in JSON. Do NOT include markdown code fences like \`\`\`markdown at the start or end.

INGESTED SOURCE DOCUMENTS:
${cleanedSources}`;

                let rawMarkdown = '';
                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawMarkdown = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  } else {
                    const errBody = await resp.text();
                    console.error('Gemini report error:', resp.status, errBody);
                  }
                } else if (targetBase) {
                  const targetUrl = `${targetBase.replace(/\/+$/, '')}/chat/completions`;
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                  const resp = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [{ role: 'user', content: prompt }],
                      max_tokens: 8192,
                      temperature: 0.3,
                    }),
                    signal: AbortSignal.timeout(120000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const choice = data.choices?.[0]?.message;
                    rawMarkdown = choice?.content || choice?.reasoning_content || '';
                  } else {
                    const errBody = await resp.text();
                    console.error('LLM report API error:', resp.status, errBody);
                  }
                }

                if (rawMarkdown && rawMarkdown.trim().length > 100) {
                  const cleanMarkdown = rawMarkdown
                    .replace(/^```(?:markdown)?\s*\n?/i, '')
                    .replace(/\n?```\s*$/i, '')
                    .trim();

                  // Extract title from first line if available
                  let reportTitle = topic || 'Synthesized Report';
                  const titleMatch = cleanMarkdown.match(/^#\s+(.+)$/m);
                  if (titleMatch) {
                    reportTitle = titleMatch[1].replace(/[*_~`]/g, '').trim();
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    data: {
                      title: reportTitle,
                      content: cleanMarkdown,
                      format: targetFormat,
                      depth: targetDepth,
                      topic: topic || '',
                      tokenCount: Math.ceil(cleanMarkdown.length / 4)
                    }
                  }));
                  return;
                }
              } catch (err) {
                console.error('LLM report generation failed, using local grounded generator:', err);
              }
            }

            // If infographic and an LLM is available, generate an intelligent, grounded NotebookLM infographic
            if (type === 'infographic' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                  else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                  else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                  else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 8).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 3500)}`
                ).join('\n\n---\n\n');

                const orientation = infographicConfig?.orientation || 'landscape';
                const style = infographicConfig?.style || 'auto';
                const detail = infographicConfig?.detail || 'standard';
                const customPrompt = infographicConfig?.customPrompt || '';

                const prompt = `You are Google NotebookLM's Principal Information Architect and Lead Visual Art Director.
Analyze the provided source documents and synthesize a publication-grade, visually engaging Infographic specification in JSON format, including BOTH structured quantitative data AND an exquisitely detailed, narrative text-to-image prompt ("imagePrompt") for state-of-the-art generative image models (Imagen 3, DALL-E 3, FLUX 1.1 Pro).

INFOGRAPHIC CONFIGURATION:
- Orientation: ${orientation}
- Visual Style: ${style}
- Level of Detail: ${detail}
- Target Language: ${language || 'English'}
- Specific Focus / Guidance: "${customPrompt || 'Extract the highest-impact findings, core metrics, process flow, and thematic breakdown.'}"

CRITICAL REQUIREMENTS:
1. All figures, claims, and conclusions must be strictly grounded in the ingested sources.
2. In the "imagePrompt" field: Write an extensive, vivid, publication-grade image generation prompt (150-250 words) tailored specifically to the chosen visual style (${style}), orientation (${orientation}), and ingested documents.
   IMPORTANT: DO NOT simply output a list of comma-separated keywords or glue together disconnected phrases (e.g. NEVER output "infographic, anime, fusion, blue").
   Instead, write a rich, cohesive, art-directed descriptive paragraph instructing the image model on:
   - Specific artistic medium and aesthetic hallmarks of ${style} (e.g., if kawaii: cute pastel palette, rounded pill badges, playful chibi illustrations; if clay: stop-motion plasticine with tactile thumbprint textures and soft studio bounce lighting; if anime: crisp cel-shaded dynamic linework, vibrant neon rim-lighting, high-tech HUD overlays; if sketch_note: hand-drawn fountain pen and ink crosshatching on aged grid paper with highlighter notes; if vintage: 19th-century copperplate patent engraving with sepia patina; if editorial: Swiss minimalist grid, bold modernist typography, high-contrast flat vector geometry; if 3d_render: glossy isometric Cinema 4D / Octane render with subsurface scattering; if watercolor: delicate wet-on-wet pigment blooms and cold-press paper grain).
   - Compositional layout tailored for ${orientation} aspect ratio (landscape 16:9 panoramic poster, portrait 9:16 vertical infographic banner, or square 1:1 balanced card).
   - Detailed visual representation of the core conceptual mechanisms, diagrams, and focal milestones from the ingested sources.
   - Typography and graphic design guidelines for the main headline and data callouts.
3. Return ONLY a valid JSON object matching the schema below. No markdown backticks, no explanations.

JSON SCHEMA:
{
  "title": "Clear, high-impact headline",
  "subtitle": "Informative grounded subheadline (1-2 sentences)",
  "imagePrompt": "Exquisitely detailed 150-250 word cohesive text-to-image prompt capturing the full art direction, visual layout, and grounded concepts for image generation models",
  "heroStat": {
    "value": "Key headline number or metric (e.g. Q ≥ 2 or 20 T or 99.4%)",
    "label": "Metric title",
    "description": "Short explanation of significance"
  },
  "metrics": [
    {
      "label": "Metric name",
      "value": "Concise quantitative or status value",
      "description": "Contextual grounded note",
      "change": "Optional growth/status badge (e.g. +140%, New, World Record)"
    }
  ],
  "processFlow": [
    {
      "step": "01",
      "title": "Stage or milestone title",
      "summary": "1 sentence description"
    }
  ],
  "breakdown": [
    {
      "category": "Theme or domain name",
      "percentage": 35,
      "description": "Key contribution or focus"
    }
  ],
  "keyInsights": [
    "High-impact takeaway 1",
    "High-impact takeaway 2",
    "High-impact takeaway 3"
  ],
  "takeaway": "Concluding strategic synthesis summary sentence."
}

INGESTED SOURCE DOCUMENTS:
${cleanedSources}`;

                let rawJson = '';
                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  }
                } else if (apiKey || provider === 'ollama' || provider === 'lmstudio') {
                  const resp = await fetch(`${targetBase}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                    },
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [
                        { role: 'system', content: 'You are Google NotebookLM\'s Infographic Synthesis Engine. Return ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                      ],
                      temperature: 0.2,
                      response_format: { type: 'json_object' }
                    }),
                    signal: AbortSignal.timeout(60000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.choices?.[0]?.message?.content || '';
                  }
                }

                if (rawJson) {
                  let cleaned = rawJson.trim();
                  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                  const parsed = JSON.parse(cleaned);
                  if (parsed && (parsed.title || parsed.metrics)) {
                    parsed.orientation = orientation;
                    parsed.style = style;
                    parsed.detail = detail;
                    parsed.customPrompt = customPrompt;
                    parsed.sourcesCited = (sources || []).map((s: any) => s.title);

                    // If image provider / key available, attempt visual image generation
                    const effectiveImgKey = imageApiKey || (imageProvider === 'google' && provider === 'gemini' ? apiKey : imageProvider === 'openai' && provider === 'openai' ? apiKey : '');
                    if (effectiveImgKey && parsed.imagePrompt) {
                      try {
                        const imgRes = await generateInfographicImageBackend(
                          parsed.imagePrompt,
                          orientation,
                          imageProvider || 'google',
                          effectiveImgKey,
                          imageModel || '',
                          imageBaseUrl
                        );
                        if (imgRes.success && imgRes.imageUrl) {
                          parsed.imageUrl = imgRes.imageUrl;
                        }
                      } catch (e) {
                        console.error('Initial image generation failed (continuing with structured canvas):', e);
                      }
                    }

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, data: parsed }));
                    return;
                  }
                }
              } catch (err) {
                console.error('LLM infographic generation failed, using local grounded generator:', err);
              }
            }

            // If audio and an LLM is available, synthesize a two-host conversational podcast dialogue
            if (type === 'audio' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'grok') targetBase = 'https://api.x.ai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                  else if (provider === 'moonshotai') targetBase = 'https://api.moonshot.cn/v1';
                  else if (provider === 'zai') targetBase = 'https://open.bigmodel.cn/api/paas/v4';
                  else if (provider === 'qwen') targetBase = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 4000)}`
                ).join('\n\n---\n\n');

                const audioFormat = audioConfig?.format || 'deep_dive';
                const audioLength = audioConfig?.length || 'default';
                const customPrompt = audioConfig?.customPrompt || '';

                let turnCount = '12 to 16 exchanges';
                if (audioLength === 'short') turnCount = '6 to 8 concise exchanges';
                else if (audioLength === 'long') turnCount = '20 to 24 in-depth exchanges';

                let formatDirective = 'Deep Dive: A lively, warm, and natural conversation between two charismatic hosts (Sarah and Michael), unpacking complex concepts, connecting disparate themes, and using relatable analogies.';
                if (audioFormat === 'brief') {
                  formatDirective = 'Brief: A bite-sized, high-efficiency overview where hosts quickly outline and synthesize the core ideas from the sources in minimum time.';
                } else if (audioFormat === 'critique') {
                  formatDirective = 'Critique: An expert critical review. Sarah acts as principal analyst evaluating claims, while Michael probes methodology, questions assumptions, and points out gaps or trade-offs.';
                } else if (audioFormat === 'debate') {
                  formatDirective = 'Debate: A spirited, intellectual debate where Sarah and Michael take opposing perspectives on key interpretations or trade-offs in the sources, challenging each other with grounded evidence.';
                }

                const prompt = `You are Google NotebookLM's Audio Overview Generation Engine.
Synthesize the provided source documents into a publication-grade, ultra-natural spoken conversation between two AI hosts: Sarah and Michael.

CONFIGURATION:
- Format: ${formatDirective}
- Target Length: ${turnCount}
- Spoken Language: ${language || 'English'}
- Specific Focus / Host Instructions: "${customPrompt || 'Cover the foundational breakthroughs, empirical metrics, and core takeaways.'}"

CRITICAL REQUIREMENTS:
1. Grounding: All dialogue must be strictly anchored to facts, claims, and findings in the source documents.
2. Natural Spoken Dialogue: Use conversational markers, natural transitions ("Exactly, Michael", "What surprised me was...", "Let's unpack that", "Wait, but isn't it true that..."), lively back-and-forth, and authentic enthusiasm.
3. Return ONLY valid JSON matching this schema:
{
  "podcastDialogue": [
    { "speaker": "Sarah", "avatar": "bg-purple-600", "text": "..." },
    { "speaker": "Michael", "avatar": "bg-blue-600", "text": "..." }
  ]
}

INGESTED SOURCE DOCUMENTS:
${cleanedSources}`;

                let rawJson = '';
                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  }
                } else if (apiKey || provider === 'ollama' || provider === 'lmstudio') {
                  const resp = await fetch(`${targetBase}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                    },
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [
                        { role: 'system', content: 'You are Google NotebookLM\'s Audio Overview Generation Engine. Return ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                      ],
                      temperature: 0.3,
                      response_format: { type: 'json_object' }
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.choices?.[0]?.message?.content || '';
                  }
                }

                if (rawJson) {
                  let cleaned = rawJson.trim();
                  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                  const parsed = JSON.parse(cleaned);
                  if (parsed?.podcastDialogue && Array.isArray(parsed.podcastDialogue) && parsed.podcastDialogue.length > 0) {
                    parsed.language = language;
                    parsed.format = audioFormat;
                    parsed.length = audioLength;
                    parsed.topic = topic || (sources?.[0]?.title || 'Audio Overview');
                    parsed.sourcesCited = (sources || []).map((s: any) => s.title);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, data: parsed }));
                    return;
                  }
                }
              } catch (err) {
                console.error('LLM audio generation failed, using local grounded generator:', err);
              }
            }

            // If slides and an LLM is available, synthesize a publication-grade Slide Deck
            if (type === 'slides' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 4000)}`
                ).join('\n\n---\n\n');

                const slideFormat = slideConfig?.format || 'detailed_deck';
                const slideLength = slideConfig?.length || 'default';
                const customPrompt = slideConfig?.customPrompt || '';

                let slideCount = '7 to 9 slides';
                if (slideLength === 'short') slideCount = '4 to 5 slides';

                let formatDirective = 'Detailed Deck: A comprehensive deck with full text, analytical subheadings, structured bullet points, and quantitative data. Perfect for emailing, sharing, or reading on its own.';
                if (slideFormat === 'presenter_slides') {
                  formatDirective = 'Presenter Slides: Clean, visual slides with punchy, high-impact bullet points, large stat callouts, and comprehensive "notes" (speaker notes) providing verbatim talking points for the presenter to speak aloud.';
                }

                const prompt = `You are Google NotebookLM's Slide Deck Engine.
Synthesize the provided source documents into a publication-ready presentation deck in JSON format.

CONFIGURATION:
- Format: ${formatDirective}
- Slide Count: ${slideCount}
- Language: ${language || 'English'}
- User Focus / Outline Guidance: "${customPrompt || 'Synthesize the essential findings, architectural principles, evidence benchmarks, and strategic implications.'}"

CRITICAL REQUIREMENTS:
1. Every slide must have a crisp title, subtitle, 3-4 structured points, a statCallout ({ value, label }), comprehensive presenter notes ("notes"), and a visual imagePrompt ("imagePrompt") describing the slide illustration.
2. Return ONLY valid JSON matching this schema:
{
  "slides": [
    {
      "title": "1. Slide Title",
      "subtitle": "Informative subtitle",
      "points": ["Key point 1", "Key point 2", "Key point 3"],
      "statCallout": { "value": "99.4%", "label": "Confidence Metric" },
      "notes": "Detailed speaking notes for the presenter.",
      "imagePrompt": "Aesthetic prompt describing visual background / graphic diagram."
    }
  ]
}

INGESTED SOURCE DOCUMENTS:
${cleanedSources}`;

                let rawJson = '';
                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  }
                } else if (apiKey || provider === 'ollama' || provider === 'lmstudio') {
                  const resp = await fetch(`${targetBase}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                    },
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [
                        { role: 'system', content: 'You are Google NotebookLM\'s Slide Deck Engine. Return ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                      ],
                      temperature: 0.2,
                      response_format: { type: 'json_object' }
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.choices?.[0]?.message?.content || '';
                  }
                }

                if (rawJson) {
                  let cleaned = rawJson.trim();
                  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                  const parsed = JSON.parse(cleaned);
                  if (parsed?.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
                    parsed.language = language;
                    parsed.format = slideFormat;
                    parsed.length = slideLength;
                    parsed.topic = topic || (sources?.[0]?.title || 'Slide Deck');
                    parsed.customPrompt = customPrompt;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, data: parsed }));
                    return;
                  }
                }
              } catch (err) {
                console.error('LLM slides generation failed, using local grounded generator:', err);
              }
            }

            // If video and an LLM is available, synthesize a scene-by-scene Video Script
            if (type === 'video' && (apiKey || provider === 'ollama' || provider === 'lmstudio')) {
              try {
                let targetBase = baseUrl;
                if (!targetBase) {
                  if (provider === 'openai') targetBase = 'https://api.openai.com/v1';
                  else if (provider === 'groq') targetBase = 'https://api.groq.com/openai/v1';
                  else if (provider === 'deepseek') targetBase = 'https://api.deepseek.com';
                  else if (provider === 'openrouter') targetBase = 'https://openrouter.ai/api/v1';
                  else if (provider === 'ollama') targetBase = 'http://localhost:11434/v1';
                  else if (provider === 'lmstudio') targetBase = 'http://localhost:1234/v1';
                }

                let effectiveModel = model;
                if (provider === 'deepseek') {
                  if (!effectiveModel || !effectiveModel.toLowerCase().includes('deepseek')) effectiveModel = 'deepseek-chat';
                } else if (provider === 'gemini') {
                  effectiveModel = (model && !model.includes('3.8')) ? model : 'gemini-2.5-flash';
                } else if (provider === 'openai') {
                  if (!effectiveModel) effectiveModel = 'gpt-4o';
                } else if (provider === 'groq') {
                  if (!effectiveModel) effectiveModel = 'llama-3.3-70b-versatile';
                }

                const cleanedSources = (sources || []).slice(0, 10).map((s: any, idx: number) => 
                  `[Source ${idx + 1}] Title: "${s.title}"\n${cleanSourceContent(s.content).slice(0, 4000)}`
                ).join('\n\n---\n\n');

                const videoFormat = videoConfig?.format || 'short';
                const focusTopic = videoConfig?.focusTopic || videoConfig?.customTopic || topic || (sources[0]?.title || 'Video Overview');
                const isShort = videoFormat === 'short';

                let formatDirective = 'Short: A vertical 9:16 smartphone video (TikTok / Reels / YouTube Shorts style). Starts with an explosive 3-second hook to stop scrolling, followed by 3 fast-paced evidence beats with kinetic text, and a crisp call-to-action.';
                if (videoFormat === 'explainer') {
                  formatDirective = 'Explainer: A structured, comprehensive 16:9 widescreen educational/documentary video connecting the dots across topics in 5-7 clear narrative chapters with cinematic visual prompts and informative on-screen text.';
                }

                const prompt = `You are Google NotebookLM's Video Overview Engine.
Synthesize the provided source documents into a production-grade video script in JSON format.

CONFIGURATION:
- Format: ${formatDirective}
- Focus Topic: "${focusTopic}"
- Target Language: ${language || 'English'}

CRITICAL REQUIREMENTS:
1. All assertions and facts must be directly grounded in the ingested source material.
2. Each scene must include:
   - "title": Scene / chapter title (e.g. "Scene 1: Hook (0-3s)" or "Chapter 1: Foundational Framework")
   - "narration": The verbatim voiceover spoken by the narrator.
   - "visualPrompt": Highly descriptive cinematic visual prompt for video/image generation models (describing camera movement, lighting, subject matter, and framing).
   - "duration": Duration in seconds (integer, e.g. 4, 7, 9).
   - "onScreenText": Kinetic text overlay to be displayed on screen.
3. Return ONLY valid JSON matching this schema:
{
  "scenes": [
    {
      "title": "Scene 1: ...",
      "narration": "...",
      "visualPrompt": "...",
      "duration": 5,
      "onScreenText": "..."
    }
  ]
}

INGESTED SOURCE DOCUMENTS:
${cleanedSources}`;

                let rawJson = '';
                if (provider === 'gemini') {
                  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ role: 'user', parts: [{ text: prompt }] }],
                      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  }
                } else if (apiKey || provider === 'ollama' || provider === 'lmstudio') {
                  const resp = await fetch(`${targetBase}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                    },
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: [
                        { role: 'system', content: 'You are Google NotebookLM\'s Video Overview Engine. Return ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                      ],
                      temperature: 0.2,
                      response_format: { type: 'json_object' }
                    }),
                    signal: AbortSignal.timeout(90000),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    rawJson = data.choices?.[0]?.message?.content || '';
                  }
                }

                if (rawJson) {
                  let cleaned = rawJson.trim();
                  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                  const parsed = JSON.parse(cleaned);
                  if (parsed?.scenes && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
                    parsed.language = language;
                    parsed.format = videoFormat;
                    parsed.focusTopic = focusTopic;
                    parsed.title = focusTopic;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, data: parsed }));
                    return;
                  }
                }
              } catch (err) {
                console.error('LLM video generation failed, using local grounded generator:', err);
              }
            }

            // Grounded local fallback generator
            const artifactData = generateLocalArtifact(
              type, sources || [], language || 'English', topic,
              quizConfig, flashcardConfig, reportConfig, infographicConfig,
              audioConfig, slideConfig, videoConfig
            );
            if (type === 'quiz' && artifactData?.quiz) {
              artifactData.quiz = shuffleQuizQuestions(artifactData.quiz);
            }
            if (type === 'infographic' && artifactData?.imagePrompt) {
              const effectiveImgKey = imageApiKey || (imageProvider === 'google' && provider === 'gemini' ? apiKey : imageProvider === 'openai' && provider === 'openai' ? apiKey : '');
              if (effectiveImgKey) {
                try {
                  const imgRes = await generateInfographicImageBackend(
                    artifactData.imagePrompt,
                    infographicConfig?.orientation || 'landscape',
                    imageProvider || 'google',
                    effectiveImgKey,
                    imageModel || '',
                    imageBaseUrl
                  );
                  if (imgRes.success && imgRes.imageUrl) {
                    artifactData.imageUrl = imgRes.imageUrl;
                  }
                } catch (e) {}
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: artifactData }));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        res.statusCode = 405; res.end();
      });

      // 6.6 Generate Tailored AI Report Format Suggestions (Google NotebookLM)
      server.middlewares.use('/api/suggest-report-formats', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const { sources, provider, apiKey, baseUrl, model } = body;
            const suggestions = await generateReportSuggestions(sources || [], provider, apiKey, baseUrl, model);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, suggestions }));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message, suggestions: [] }));
            return;
          }
        }
        res.statusCode = 405; res.end();
      });

      // 6.7 Dedicated AI Image Generator Endpoint
      server.middlewares.use('/api/generate-image', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const { prompt, orientation, imageProvider, imageApiKey, imageModel, imageBaseUrl } = body;
            const result = await generateInfographicImageBackend(
              prompt,
              orientation || 'landscape',
              imageProvider,
              imageApiKey,
              imageModel,
              imageBaseUrl
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        res.statusCode = 405; res.end();
      });

      // 7. Generate AI Source Guide (Google NotebookLM Source Guide)
      server.middlewares.use('/api/source-guide', async (req, res) => {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          const { title, content } = body;
          const guide = generateLocalSourceGuide(title || 'Source Document', content || '');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, guide }));
          return;
        }
        res.statusCode = 405; res.end();
      });

      // 8. Autonomous Deep Research Engine (supports SSE streaming & standard POST)
      server.middlewares.use('/api/deep-research', async (req, res) => {
        if (req.method === 'POST') {
          try {
            const body = await parseBody(req);
            const { query, scope, provider, apiKey, stream } = body;

            if (stream) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              });

              const sendEvent = (event: string, data: any) => {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
              };

              try {
                const result = await runDeepResearchEngine(
                  query || 'Autonomous AI',
                  scope || 'Web',
                  provider || 'duckduckgo',
                  apiKey || '',
                  (log, stats) => {
                    sendEvent('progress', { log, stats });
                  }
                );

                sendEvent('complete', result);
                res.end();
              } catch (err: any) {
                sendEvent('error', { error: err.message });
                res.end();
              }
              return;
            }

            const result = await runDeepResearchEngine(
              query || 'Autonomous AI',
              scope || 'Web',
              provider || 'duckduckgo',
              apiKey || ''
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, ...result }));
            return;
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        res.statusCode = 405; res.end();
      });
    };

    return {
      name: 'model-fetcher-plugin',
      configureServer(server) {
        registerRoutes(server);
      },
      configurePreviewServer(server) {
        registerRoutes(server);
      },
    };
  }

export default defineConfig({
  plugins: [react(), modelFetcherPlugin()],
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-katex': ['katex', 'rehype-katex', 'remark-math'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-pdf': ['html2pdf.js', 'pdf-parse'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
