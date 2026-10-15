// Script para verificar e limpar dados antigos do localStorage
// Execute no console do navegador (F12) para diagnosticar problemas

export function checkLocalStorage() {
  console.log('=== Verificação do LocalStorage ===\n');

  // Verificar notebooks
  const notebooksRaw = localStorage.getItem('onb_notebooks');
  if (notebooksRaw) {
    const notebooks = JSON.parse(notebooksRaw);
    console.log(`📚 Notebooks: ${notebooks.length}`);
    
    notebooks.forEach((nb: any, i: number) => {
      console.log(`  ${i + 1}. ${nb.name} (${nb.id})`);
      console.log(`     - Fontes: ${nb.sources?.length || 0}`);
      console.log(`     - Conversas: ${nb.conversations?.length || 0}`);
      console.log(`     - Notas: ${nb.notes?.length || 0}`);
      
      // Verificar modelos nas conversas
      if (nb.conversations) {
        nb.conversations.forEach((conv: any, j: number) => {
          if (conv.model) {
            console.log(`     - Conversa ${j + 1}: ${conv.model}`);
          }
        });
      }
    });
  } else {
    console.log('❌ Nenhum notebook encontrado');
  }

  console.log('\n---\n');

  // Verificar settings
  const settingsRaw = localStorage.getItem('onb_settings');
  if (settingsRaw) {
    const settings = JSON.parse(settingsRaw);
    console.log('⚙️ Settings:');
    console.log(`  - Provedor padrão: ${settings.defaultProvider || 'não definido'}`);
    console.log(`  - Modelo padrão: ${settings.defaultModel || 'não definido'}`);
    console.log(`  - Onboarding completo: ${settings.onboardingComplete ? 'sim' : 'não'}`);
    
    if (settings.providers) {
      console.log(`  - Provedores configurados: ${Object.keys(settings.providers).length}`);
      Object.entries(settings.providers).forEach(([id, provider]: [string, any]) => {
        console.log(`    - ${id}: ${provider.status}`);
      });
    }
  } else {
    console.log('❌ Nenhum settings encontrado');
  }

  console.log('\n---\n');

  // Verificar providers
  const providersRaw = localStorage.getItem('onb_providers');
  if (providersRaw) {
    const providers = JSON.parse(providersRaw);
    console.log('🔑 Providers:');
    Object.entries(providers).forEach(([id, provider]: [string, any]) => {
      console.log(`  - ${id}: ${provider.status}`);
    });
  } else {
    console.log('❌ Nenhum provider encontrado');
  }

  console.log('\n---\n');

  // Verificar versão de migração
  const migrationVersion = localStorage.getItem('onb_migration_version');
  console.log(`🔄 Versão de migração: ${migrationVersion || 'não definida'}`);

  console.log('\n=== Fim da verificação ===\n');
}

export function clearAllData() {
  if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os dados (notebooks, configurações, providers). Tem certeza?')) {
    localStorage.removeItem('onb_notebooks');
    localStorage.removeItem('onb_settings');
    localStorage.removeItem('onb_providers');
    localStorage.removeItem('onb_migration_version');
    console.log('✅ Todos os dados foram apagados. Recarregue a página.');
    window.location.reload();
  }
}

export function clearOldModels() {
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
  ];

  let updated = false;

  // Limpar notebooks
  const notebooksRaw = localStorage.getItem('onb_notebooks');
  if (notebooksRaw) {
    const notebooks = JSON.parse(notebooksRaw);
    notebooks.forEach((nb: any) => {
      if (nb.conversations) {
        nb.conversations.forEach((conv: any) => {
          if (conv.model && DEPRECATED_MODELS.includes(conv.model)) {
            console.log(`Removendo modelo antigo da conversa: ${conv.model}`);
            conv.model = '';
            updated = true;
          }
        });
      }
    });
    if (updated) {
      localStorage.setItem('onb_notebooks', JSON.stringify(notebooks));
      console.log('✅ Notebooks atualizados');
    }
  }

  // Limpar settings
  const settingsRaw = localStorage.getItem('onb_settings');
  if (settingsRaw) {
    const settings = JSON.parse(settingsRaw);
    if (settings.defaultModel && DEPRECATED_MODELS.includes(settings.defaultModel)) {
      console.log(`Removendo modelo padrão antigo: ${settings.defaultModel}`);
      settings.defaultModel = '';
      settings.defaultProvider = '';
      localStorage.setItem('onb_settings', JSON.stringify(settings));
      console.log('✅ Settings atualizados');
    }
  }

  if (updated) {
    console.log('✅ Modelos antigos removidos. Recarregue a página.');
    window.location.reload();
  } else {
    console.log('✅ Nenhum modelo antigo encontrado');
  }
}

// Tornar funções disponíveis globalmente no console
if (typeof window !== 'undefined') {
  (window as any).checkONB = checkLocalStorage;
  (window as any).clearONB = clearAllData;
  (window as any).cleanONBModels = clearOldModels;
  
  console.log('🔧 Comandos disponíveis no console:');
  console.log('  - checkONB() - Verificar dados');
  console.log('  - clearONB() - Apagar tudo');
  console.log('  - cleanONBModels() - Limpar modelos antigos');
}
