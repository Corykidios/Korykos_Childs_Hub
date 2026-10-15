# 🎯 Configuração de Conversas por Notebook

## ✨ Nova Funcionalidade Implementada

Adicionei um sistema completo de configuração de conversas por notebook, similar ao NotebookLM do Google, permitindo personalizar o comportamento da IA para diferentes objetivos.

---

## 🚀 Como Usar

### 1. Acessar as Configurações

No notebook, clique no ícone de **engrenagem** (⚙️) no header ao lado dos botões de exportação.

### 2. Escolher o Modo da Conversa

#### 📘 **Padrão**
- **Ideal para:** Pesquisas gerais e discutir ideias
- **Comportamento:** Respostas equilibradas, sem foco específico
- **Uso:** Conversas casuais, brainstorming, exploração de tópicos

#### 🎓 **Guia de Aprendizagem**
- **Ideal para:** Conteúdo educacional
- **Comportamento:** 
  - Explica conceitos de forma clara e didática
  - Usa exemplos práticos
  - Faz analogias quando possível
  - Verifica o entendimento do usuário
  - Prioriza o aprendizado efetivo
- **Uso:** Estudar novos conceitos, aprender habilidades, entender temas complexos

#### ⚙️ **Personalizado**
- **Ideal para:** Casos específicos com regras customizadas
- **Campos disponíveis:**
  - **Papel da IA:** Ex: "Especialista em direito digital", "Professor de matemática"
  - **Tom da conversa:** Ex: "Formal", "Casual", "Acadêmico", "Didático"
  - **Instruções personalizadas:** Texto livre para definir regras específicas

### 3. Escolher o Tamanho da Resposta

#### 📏 **Mais Curta**
- Respostas concisas e diretas
- Ideal para respostas rápidas e objetivas

#### 📏 **Padrão**
- Equilíbrio entre detalhe e concisão
- Comportamento padrão da IA

#### 📏 **Mais Longa**
- Respostas detalhadas e completas
- Ideal para explicações aprofundadas

### 4. Salvar Configurações

Clique em **"Salvar Configurações"** para aplicar as mudanças ao notebook.

---

## 🎨 Interface

### Modal de Configuração

O modal apresenta:

1. **Título:** "Configurar Conversas"
2. **Subtítulo:** "Personalize este notebook para alcançar diferentes objetivos"
3. **Seção 1:** Modo da Conversa (3 opções com ícones e descrições)
4. **Seção 2:** Configurações Personalizadas (aparece apenas no modo "Personalizado")
   - Campo: Papel da IA
   - Campo: Tom da conversa
   - Campo: Instruções personalizadas (textarea)
5. **Seção 3:** Tamanho da Resposta (3 opções em grid)
6. **Botões:** Cancelar e Salvar Configurações

---

## 🔧 Implementação Técnica

### Arquivos Modificados

#### 1. `src/lib/types.ts`
Adicionados novos tipos:
```typescript
export type ConversationMode = 'default' | 'learning_guide' | 'custom';
export type ResponseLength = 'short' | 'default' | 'long';

export interface ConversationConfig {
  mode: ConversationMode;
  responseLength: ResponseLength;
  customInstructions?: string;
  role?: string;
  tone?: string;
}
```

Atualizado `NotebookSettings`:
```typescript
export interface NotebookSettings {
  // ... campos existentes
  conversationConfig?: ConversationConfig;
}
```

#### 2. `src/components/ConversationConfig.tsx` (NOVO)
Componente completo do modal de configuração com:
- Seleção de modo (Padrão, Guia de Aprendizagem, Personalizado)
- Campos personalizados (rolê, tom, instruções)
- Seleção de tamanho de resposta
- Salvamento no notebook

#### 3. `src/components/NotebookView.tsx`
- Adicionado botão de configurações (ícone de engrenagem) no header
- Estado `showConfig` para controlar modal
- Renderização do componente `ConversationConfig`

#### 4. `src/store/useStore.ts`
Atualizada função `sendMessage` para aplicar configurações:
```typescript
// Aplicar configurações de conversa
const conversationConfig = notebook.settings.conversationConfig;
if (conversationConfig) {
  // Adicionar modo da conversa
  if (conversationConfig.mode === 'learning_guide') {
    systemPrompt += `\n\nMODO: Guia de Aprendizagem\n...`;
  } else if (conversationConfig.mode === 'custom') {
    // Adicionar papel, tom e instruções personalizadas
  }
  
  // Adicionar tamanho da resposta
  if (conversationConfig.responseLength === 'short') {
    systemPrompt += `\n\nTAMANHO DA RESPOSTA: Seja conciso...`;
  } else if (conversationConfig.responseLength === 'long') {
    systemPrompt += `\n\nTAMANHO DA RESPOSTA: Seja detalhado...`;
  }
}
```

---

## 📊 Como Funciona

### Fluxo de Configuração

1. **Usuário clica no ícone de engrenagem** no header do notebook
2. **Modal abre** com as opções de configuração
3. **Usuário seleciona:**
   - Modo da conversa (Padrão/Guia/Personalizado)
   - Tamanho da resposta (Curta/Padrão/Longa)
   - Se personalizado: papel, tom e instruções
4. **Usuário clica em "Salvar Configurações"**
5. **Configurações são salvas** no `notebook.settings.conversationConfig`
6. **Ao enviar mensagem**, o store aplica as configurações no system prompt
7. **IA responde** seguindo as regras configuradas

### Exemplo de System Prompt Gerado

#### Modo: Guia de Aprendizagem + Resposta Longa
```
Você é um assistente de pesquisa útil. Responda com base nas fontes fornecidas. Cite as fontes usando [Fonte X].

MODO: Guia de Aprendizagem
Você está atuando como um guia educacional. Explique conceitos de forma clara e didática, use exemplos práticos, faça analogias quando possível e verifique o entendimento do usuário. Priorize o aprendizado efetivo.

TAMANHO DA RESPOSTA: Seja detalhado e completo. Respostas longas e abrangentes.

FONTES DISPONÍVEIS:
[Fonte 1: artigo.pdf]
...
```

#### Modo: Personalizado + Resposta Curta
```
Você é um assistente de pesquisa útil. Responda com base nas fontes fornecidas. Cite as fontes usando [Fonte X].

PAPEL: Especialista em direito digital com 20 anos de experiência

TOM: Formal e acadêmico

INSTRUÇÕES PERSONALIZADAS:
Sempre cite a legislação brasileira relevante. Use terminologia jurídica precisa. Evite simplificações excessivas.

TAMANHO DA RESPOSTA: Seja conciso e direto. Respostas curtas e objetivas.

FONTES DISPONÍVEIS:
...
```

---

## 🎯 Casos de Uso

### 1. **Estudante Universitário**
- **Modo:** Guia de Aprendizagem
- **Tamanho:** Mais longa
- **Objetivo:** Entender conceitos complexos de forma didática

### 2. **Pesquisador Jurídico**
- **Modo:** Personalizado
- **Papel:** Especialista em direito digital
- **Tom:** Formal e acadêmico
- **Instruções:** Citar legislação brasileira, usar terminologia jurídica
- **Tamanho:** Padrão

### 3. **Desenvolvedor**
- **Modo:** Padrão
- **Tamanho:** Mais curta
- **Objetivo:** Respostas rápidas e diretas sobre código

### 4. **Professor**
- **Modo:** Guia de Aprendizagem
- **Tamanho:** Mais longa
- **Objetivo:** Criar material didático e explicar conceitos

### 5. **Analista de Dados**
- **Modo:** Personalizado
- **Papel:** Analista de dados sênior
- **Instruções:** Focar em insights acionáveis, usar exemplos com dados
- **Tamanho:** Padrão

---

## 💡 Dicas de Uso

### Para Melhor Resultados

1. **Seja específico nas instruções personalizadas**
   - ❌ "Seja bom"
   - ✅ "Sempre cite fontes acadêmicas, use linguagem formal, foque em aplicações práticas"

2. **Combine modo e tamanho adequadamente**
   - Guia de Aprendizagem + Longa = Explicações detalhadas
   - Padrão + Curta = Respostas rápidas
   - Personalizado + qualquer = Comportamento customizado

3. **Use o papel da IA para contextos específicos**
   - "Médico especialista em cardiologia"
   - "Professor de inglês nativo"
   - "Consultor financeiro certificado"

4. **Defina o tom para consistência**
   - Formal: Relatórios, documentos oficiais
   - Casual: Brainstorming, ideias criativas
   - Didático: Ensino, tutoriais
   - Técnico: Documentação, especificações

---

## 🔍 Diferenças do NotebookLM

### Semelhanças
- ✅ Configuração por notebook
- ✅ Modos pré-definidos (Padrão, Guia de Aprendizagem)
- ✅ Opção personalizada
- ✅ Tamanho da resposta

### Diferenciais do OpenNotebook AI
- ✅ **Multi-provider:** Funciona com qualquer modelo de IA
- ✅ **Campo de papel:** Define expertise específica da IA
- ✅ **Campo de tom:** Controla o estilo da conversa
- ✅ **Instruções livres:** Texto completo para regras customizadas
- ✅ **Persistência:** Configurações salvas por notebook
- ✅ **RAG integrado:** Configurações funcionam com fontes

---

## 📝 Estrutura de Dados

### Notebook com Configuração
```typescript
{
  id: "uuid",
  name: "Pesquisa de TCC",
  settings: {
    defaultModel: "gpt-4o",
    defaultProvider: "openai",
    mode: "sources",
    // ... outros settings
    conversationConfig: {
      mode: "learning_guide",
      responseLength: "long",
      customInstructions: "",
      role: "",
      tone: ""
    }
  },
  // ... resto do notebook
}
```

### Notebook com Configuração Personalizada
```typescript
{
  id: "uuid",
  name: "Consultoria Jurídica",
  settings: {
    // ...
    conversationConfig: {
      mode: "custom",
      responseLength: "default",
      customInstructions: "Sempre cite a legislação brasileira relevante. Use terminologia jurídica precisa.",
      role: "Especialista em direito digital com 20 anos de experiência",
      tone: "Formal e acadêmico"
    }
  }
}
```

---

## 🚀 Próximas Melhorias Sugeridas

### Fase 1: UX
- [ ] Preview das configurações antes de salvar
- [ ] Templates pré-configurados (Estudante, Pesquisador, Professor)
- [ ] Indicador visual das configurações ativas no header

### Fase 2: Funcionalidades
- [ ] Configurações por conversa (além do notebook)
- [ ] Histórico de configurações (versionamento)
- [ ] Exportar/importar configurações
- [ ] Sugestões automáticas baseadas no conteúdo

### Fase 3: IA
- [ ] IA sugere configurações baseadas nas fontes
- [ ] Detecção automática do melhor modo
- [ ] Ajuste dinâmico durante a conversa

---

## ✅ Status

- **Build:** Sucesso ✅
- **Componente:** ConversationConfig criado ✅
- **Integração:** NotebookView atualizado ✅
- **Store:** Lógica de aplicação implementada ✅
- **Tipos:** TypeScript atualizado ✅
- **Documentação:** Completa ✅

---

## 🎉 Conclusão

O sistema de configuração de conversas está completo e funcional! Os usuários agora podem:

1. ✅ Personalizar o comportamento da IA por notebook
2. ✅ Escolher entre 3 modos (Padrão, Guia de Aprendizagem, Personalizado)
3. ✅ Definir tamanho da resposta (Curta, Padrão, Longa)
4. ✅ Configurar papel, tom e instruções personalizadas
5. ✅ Salvar configurações que persistem no notebook
6. ✅ Ver as configurações aplicadas nas respostas da IA

**Sistema pronto para uso!** 🚀

---

**Implementado com ❤️ usando React, TypeScript e Zustand**
