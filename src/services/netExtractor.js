/**
 * NER-based Structured Information Extraction
 * 
 * This module uses a Named Entity Recognition (NER) model to extract
 * structured information from bookkeeping text.
 * 
 * Entities:
 * - ITEM: Item name (e.g., "玉米", "大米")
 * - AMOUNT: Amount (e.g., "12块4", "¥35")
 * - DATE: Date (e.g., "今天", "昨天")
 * - QUANTITY: Quantity (e.g., "5斤", "10个")
 */

import { pipeline } from '@xenova/transformers';

class NERExtractor {
  constructor() {
    this.model = null;
    this.initialized = false;
  }

  /**
   * Initialize the NER model
   */
  async initialize(modelName = 'Xenova/bert-base-chinese-ner') {
    if (this.initialized) return;

    try {
      this.model = await pipeline('token-classification', modelName, {
        quantized: true, // Use quantized model for smaller size
      });
      this.initialized = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract structured information from text
   * @param {string} text - Input text
   * @returns {Object} Extracted entities
   */
  async extract(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Run NER
      const results = await this.model(text);

      // Group consecutive tokens with same entity type
      const entities = this.groupEntities(results);

      // Parse and structure the results
      const structured = this.parseEntities(entities, text);

      return structured;
    } catch (error) {
      return null;
    }
  }

  /**
   * Group consecutive tokens with the same entity type
   */
  groupEntities(tokens) {
    const entities = [];
    let currentEntity = null;

    for (const token of tokens) {
      // Skip 'O' (outside) labels
      if (token.entity === 'O' || token.score < 0.5) {
        if (currentEntity) {
          entities.push(currentEntity);
          currentEntity = null;
        }
        continue;
      }

      // Check if this token continues the current entity
      const entityType = token.entity.startsWith('I-') ? token.entity.slice(2) : 
                         token.entity.startsWith('B-') ? token.entity.slice(2) : null;

      if (!entityType) {
        if (currentEntity) {
          entities.push(currentEntity);
          currentEntity = null;
        }
        continue;
      }

      if (currentEntity && currentEntity.type === entityType) {
        // Continue current entity
        currentEntity.text += token.word;
        currentEntity.end = token.end;
        currentEntity.confidence = Math.min(currentEntity.confidence, token.score);
      } else {
        // Start new entity
        if (currentEntity) {
          entities.push(currentEntity);
        }
        currentEntity = {
          type: entityType,
          text: token.word,
          start: token.start,
          end: token.end,
          confidence: token.score
        };
      }
    }

    // Don't forget the last entity
    if (currentEntity) {
      entities.push(currentEntity);
    }

    return entities;
  }

  /**
   * Parse entities into structured format
   */
  parseEntities(entities, originalText) {
    const result = {
      item: null,
      amount: null,
      amountValue: null,
      date: null,
      quantity: null,
      rawText: originalText
    };

    for (const entity of entities) {
      switch (entity.type) {
        case 'ITEM':
          result.item = entity.text;
          break;
        
        case 'AMOUNT':
          result.amount = entity.text;
          // Try to parse the amount value
          result.amountValue = this.parseAmount(entity.text);
          break;
        
        case 'DATE':
          result.date = entity.text;
          break;
        
        case 'QUANTITY':
          result.quantity = entity.text;
          break;
      }
    }

    return result;
  }

  /**
   * Parse amount string to numeric value
   */
  parseAmount(amountStr) {
    // Remove currency symbols
    let cleaned = amountStr.replace(/[¥￥]/g, '');
    
    // Try to match complex Chinese formats
    const complexMatch = cleaned.match(/(\d+)\s*块\s*(\d{1,2})?\s*(?:毛|角)?\s*(\d{1,2})?\s*分?/);
    if (complexMatch) {
      const yuan = parseInt(complexMatch[1], 10) || 0;
      const jiao = complexMatch[2] ? parseInt(complexMatch[2], 10) : 0;
      const fen = complexMatch[3] ? parseInt(complexMatch[3], 10) : 0;
      return yuan + (jiao / 10) + (fen / 100);
    }
    
    // Try simple number
    const simpleMatch = cleaned.match(/(\d+\.?\d*)/);
    if (simpleMatch) {
      return parseFloat(simpleMatch[1]);
    }
    
    return null;
  }

  /**
   * Clean up text by removing identified entities
   */
  removeEntities(text, entities) {
    let cleaned = text;
    
    // Sort entities by position (reverse) to avoid index shifting
    const sorted = [...entities].sort((a, b) => b.start - a.start);
    
    for (const entity of sorted) {
      cleaned = cleaned.slice(0, entity.start) + cleaned.slice(entity.end);
    }
    
    return cleaned.trim();
  }
}

// Singleton instance
const nerExtractor = new NERExtractor();

export default nerExtractor;
