// ============================================
// OpenNotebook AI - RAG Pipeline
// Chunking, Embedding, and Vector Search
// ============================================

import { SourceChunk, Citation } from './types';

// ---- Text Chunking ----
export function chunkText(
  text: string,
  chunkSize: number = 512,
  overlap: number = 50
): { text: string; startChar: number; endChar: number }[] {
  const chunks: { text: string; startChar: number; endChar: number }[] = [];
  
  // Split by paragraphs first, then by sentences if needed
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let currentStart = 0;
  let charPos = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    
    if (currentChunk.length + trimmedPara.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        startChar: currentStart,
        endChar: charPos,
      });
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlap);
      currentStart = charPos - overlap;
      currentChunk = overlapText + '\n\n' + trimmedPara;
    } else {
      if (currentChunk.length === 0) {
        currentStart = charPos;
      }
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
    
    charPos += trimmedPara.length + 2; // +2 for \n\n
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      startChar: currentStart,
      endChar: charPos,
    });
  }

  return chunks;
}

// ---- Source Processing ----
export function processSourceContent(
  content: string,
  sourceId: string,
  chunkSize: number = 512,
  overlap: number = 50
): SourceChunk[] {
  const rawChunks = chunkText(content, chunkSize, overlap);
  
  return rawChunks.map((chunk, index) => ({
    id: `${sourceId}_chunk_${index}`,
    sourceId,
    index,
    text: chunk.text,
    metadata: {
      startChar: chunk.startChar,
      endChar: chunk.endChar,
    },
  }));
}

// ---- Vector Similarity Search ----
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

// ---- Hybrid Search (Vector + Keyword) ----
export function searchChunks(
  query: string,
  chunks: SourceChunk[],
  queryEmbedding: number[] | null,
  topK: number = 5,
  sources: { id: string; name: string; enabled: boolean }[] = []
): (SourceChunk & { score: number; sourceName: string })[] {
  const enabledSourceIds = sources.filter(s => s.enabled).map(s => s.id);
  const relevantChunks = enabledSourceIds.length > 0 
    ? chunks.filter(c => enabledSourceIds.includes(c.sourceId))
    : chunks;

  // Vector search scores
  const vectorScores: Map<string, number> = new Map();
  if (queryEmbedding && queryEmbedding.length > 0) {
    for (const chunk of relevantChunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        vectorScores.set(chunk.id, score);
      }
    }
  }

  // Keyword search scores (TF-based)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const keywordScores: Map<string, number> = new Map();
  
  for (const chunk of relevantChunks) {
    const chunkText = chunk.text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      const matches = chunkText.split(term).length - 1;
      score += matches * 0.1;
    }
    keywordScores.set(chunk.id, Math.min(score, 1));
  }

  // Combine scores (hybrid)
  const combinedScores: Map<string, number> = new Map();
  for (const chunk of relevantChunks) {
    const vecScore = vectorScores.get(chunk.id) || 0;
    const keyScore = keywordScores.get(chunk.id) || 0;
    // Weighted combination: 70% vector, 30% keyword
    const combined = queryEmbedding ? (vecScore * 0.7 + keyScore * 0.3) : keyScore;
    combinedScores.set(chunk.id, combined);
  }

  // Sort and return top K
  const sorted = relevantChunks
    .map(chunk => ({
      ...chunk,
      score: combinedScores.get(chunk.id) || 0,
      sourceName: sources.find(s => s.id === chunk.sourceId)?.name || 'Unknown',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return sorted;
}

// ---- Build Context from Citations ----
export function buildContextFromChunks(
  chunks: (SourceChunk & { score: number; sourceName: string })[]
): { context: string; citations: Citation[] } {
  const contextParts: string[] = [];
  const citations: Citation[] = [];

  chunks.forEach((chunk, index) => {
    contextParts.push(`[Fonte ${index + 1}: ${chunk.sourceName}]\n${chunk.text}`);
    citations.push({
      id: `cite_${index}`,
      sourceId: chunk.sourceId,
      sourceName: chunk.sourceName,
      chunkIndex: chunk.index,
      text: chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '...' : ''),
      score: chunk.score,
    });
  });

  return {
    context: contextParts.join('\n\n---\n\n'),
    citations,
  };
}

// ---- Generate Simple Embedding (fallback when no provider) ----
export function generateSimpleEmbedding(text: string): number[] {
  // Simple hash-based pseudo-embedding for demo purposes
  // In production, always use real embeddings from a provider
  const dimensions = 384;
  const embedding = new Array(dimensions).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * (i + 1)) % dimensions;
    embedding[index] += (charCode / 255) * Math.sin(i * 0.1);
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}
