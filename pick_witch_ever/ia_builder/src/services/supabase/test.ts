// Script de teste para verificar conexão com Supabase
import { supabase } from './supabase';

export async function testSupabaseConnection() {
  console.log('🧪 Iniciando teste de conexão com Supabase...\n');

  // 1. Verificar autenticação
  console.log('1️⃣ Verificando autenticação...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error('❌ Erro de autenticação:', authError.message);
    return false;
  }
  
  if (!user) {
    console.error('❌ Usuário não autenticado! Faça login primeiro.');
    return false;
  }
  
  console.log('✅ Usuário autenticado:', user.email);
  console.log('   User ID:', user.id);

  // 2. Testar inserção de notebook
  console.log('\n2️⃣ Testando inserção de notebook...');
  const testNotebook = {
    id: 'test-' + Date.now(),
    user_id: user.id,
    name: 'Notebook de Teste',
    description: 'Este é um notebook de teste',
    icon: '📚',
    color: '#7c3aed',
    settings: {},
  };

  try {
    const { data, error } = await supabase
      .from('notebooks')
      .insert([testNotebook])
      .select();

    if (error) {
      console.error('❌ Erro ao inserir notebook:', error.message);
      console.error('   Detalhes:', error);
      
      if (error.message.includes('row-level security')) {
        console.error('\n⚠️  PROBLEMA: Row Level Security (RLS) está bloqueando!');
        console.error('   Solução: Verifique se as policies foram criadas corretamente.');
        console.error('   Execute novamente o script QUERIES_SQL.sql no Supabase.');
      }
      
      return false;
    }

    console.log('✅ Notebook inserido com sucesso!');
    console.log('   ID:', data[0].id);
    console.log('   Nome:', data[0].name);

    // 3. Testar leitura
    console.log('\n3️⃣ Testando leitura de notebooks...');
    const { data: notebooks, error: readError } = await supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', user.id);

    if (readError) {
      console.error('❌ Erro ao ler notebooks:', readError.message);
      return false;
    }

    console.log(`✅ ${notebooks.length} notebook(s) encontrado(s)`);
    notebooks.forEach((nb, i) => {
      console.log(`   ${i + 1}. ${nb.name} (ID: ${nb.id})`);
    });

    // 4. Limpar notebook de teste
    console.log('\n4️⃣ Limpando notebook de teste...');
    const { error: deleteError } = await supabase
      .from('notebooks')
      .delete()
      .eq('id', testNotebook.id);

    if (deleteError) {
      console.error('❌ Erro ao deletar notebook de teste:', deleteError.message);
    } else {
      console.log('✅ Notebook de teste deletado');
    }

    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('   Supabase está funcionando corretamente.');
    return true;

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return false;
  }
}

// Executar teste automaticamente no console
if (typeof window !== 'undefined') {
  (window as any).testSupabase = testSupabaseConnection;
  console.log('💡 Digite "testSupabase()" no console para testar a conexão');
}
