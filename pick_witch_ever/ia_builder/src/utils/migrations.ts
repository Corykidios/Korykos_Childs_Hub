// ============================================
// Migration script to clean up old data
// Runs on app load to update deprecated models
// ============================================

import { PROVIDER_DEFINITIONS } from './ai-adapter';

// List of deprecated model IDs that should be removed/updated
const DEPRECATED_MODELS = [
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o3-mini',
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-small-latest',
];

// Mapping of old models to new replacements
const MODEL_REPLACEMENTS: Record<string, string> = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'mixtral-8x7b-32768': 'openai/gpt-oss-20b',
  'gpt-4o': 'gpt-5.6-terra',
  'gpt-4o-mini': 'gpt-5.6-luna',
  'o1': 'gpt-6-astra',
  'o3-mini': 'gpt-5.6-terra',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-opus-20240229': 'claude-opus-5',
  'claude-3-haiku-20240307': 'claude-haiku-4-5-20251001',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'mistral-large-latest': 'mistral-large-latest',
  'mistral-medium-latest': 'mistral-medium-latest',
  'mistral-small-latest': 'mistral-small-latest',
};

export function runMigrations(): { migrated: boolean; changes: string[] } {
  const changes: string[] = [];
  let migrated = false;

  try {
    // Migrate settings
    const settingsRaw = localStorage.getItem('onb_settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      let settingsChanged = false;

      // Check default model
      if (settings.defaultModel && DEPRECATED_MODELS.includes(settings.defaultModel)) {
        const replacement = MODEL_REPLACEMENTS[settings.defaultModel];
        if (replacement) {
          changes.push(`Modelo padrão atualizado: ${settings.defaultModel} → ${replacement}`);
          settings.defaultModel = replacement;
          settingsChanged = true;
        }
      }

      // Atualizar provider "local" com novos modelos (APIs gratuitas + locais)
      // Sempre atualizar para garantir que modelos antigos e quebrados sejam substituídos
      if (settings.providers?.local && PROVIDER_DEFINITIONS?.local?.models) {
        settings.providers.local.models = PROVIDER_DEFINITIONS.local.models;
        changes.push(`Provider "local" atualizado com modelos confiáveis e testados`);
        settingsChanged = true;
      }

      if (settingsChanged) {
        localStorage.setItem('onb_settings', JSON.stringify(settings));
        migrated = true;
      }
    }

    // Migrate notebooks
    const notebooksRaw = localStorage.getItem('onb_notebooks');
    if (notebooksRaw) {
      const notebooks = JSON.parse(notebooksRaw);
      let notebooksChanged = false;

      for (const notebook of notebooks) {
        // Update conversation models
        if (notebook.conversations) {
          for (const conv of notebook.conversations) {
            if (conv.model && DEPRECATED_MODELS.includes(conv.model)) {
              const replacement = MODEL_REPLACEMENTS[conv.model];
              if (replacement) {
                changes.push(`Conversa atualizada: ${conv.model} → ${replacement}`);
                conv.model = replacement;
                notebooksChanged = true;
              }
            }
          }
        }

        // Update notebook default settings
        if (notebook.settings?.defaultModel && DEPRECATED_MODELS.includes(notebook.settings.defaultModel)) {
          const replacement = MODEL_REPLACEMENTS[notebook.settings.defaultModel];
          if (replacement) {
            changes.push(`Notebook "${notebook.name}" atualizado: ${notebook.settings.defaultModel} → ${replacement}`);
            notebook.settings.defaultModel = replacement;
            notebooksChanged = true;
          }
        }
      }

      if (notebooksChanged) {
        localStorage.setItem('onb_notebooks', JSON.stringify(notebooks));
        migrated = true;
      }
    }

    // Migration version marker
    const currentVersion = localStorage.getItem('onb_migration_version');
    if (currentVersion !== '2') {
      localStorage.setItem('onb_migration_version', '2');
      if (!migrated) {
        changes.push('Versão de migração atualizada para v2');
      }
      migrated = true;
    }

  } catch (e) {
    console.error('Migration error:', e);
  }

  return { migrated, changes };
}
