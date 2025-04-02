import { get } from 'svelte/store';
import { aiApiKey, aiApiUrl, enabledLanguages } from '../store';
import type { BlogPost } from '../types';
import OpenAI from 'openai';

interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

interface TranslateAndSaveOptions {
  post: {
    title: string;
    content: string;
    category: string;
    language: string;
  };
  postsDB: any; // Use proper type from your DB
  identity: any; // Use proper type from your identity
  mediaIds?: string[];
  timestamps?: {
    createdAt: number;
    updatedAt: number;
  };
  onStatusUpdate?: (lang: string, status: string) => void;
}

export class TranslationService {
  private static openaiClient: OpenAI;

  private static getClient(): OpenAI {
    if (!this.openaiClient) {
      const apiKey = get(aiApiKey);
      const apiUrl = get(aiApiUrl);

      if (!apiKey || !apiUrl) {
        throw new Error('Translation API configuration is missing');
      }

      this.openaiClient = new OpenAI({
        baseURL: apiUrl,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
    }
    return this.openaiClient;
  }

  private static async translate(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const client = this.getClient();
      
      const systemPrompt = `You are a professional translator. Translate the given text from ${request.sourceLanguage || 'the source language'} to ${request.targetLanguage}. 
Maintain the original meaning, tone, and formatting.
Preserve any technical terms, proper nouns, or specialized vocabulary.
Preserve any markdown formatting in the translation.
Only respond with the translated text, without any additional commentary.`;

      const completion = await client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.text }
        ],
        model: "deepseek-chat",
      });

      return {
        translatedText: completion.choices[0].message.content || '',
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }

  static async translatePost(post: BlogPost): Promise<Record<string, BlogPost>> {
    const translations: Record<string, BlogPost> = {};
    const enabledLangs = get(enabledLanguages);
    
    // Detect source language from content
    const sourceLanguage = post.language || 'en'; // Default to English if not specified
    
    // Translate to each enabled language
    for (const lang of enabledLangs) {
      console.log('lang', lang);
      if (lang === sourceLanguage) {
        translations[lang] = post;
        continue;
      }

      try {
        // Translate title
        const titleTranslation = await this.translate({
          text: post.title,
          targetLanguage: lang,
          sourceLanguage
        });

        // Translate content
        const contentTranslation = await this.translate({
          text: post.content,
          targetLanguage: lang,
          sourceLanguage
        });

        // Translate category if needed
        const categoryTranslation = await this.translate({
          text: post.category,
          targetLanguage: lang,
          sourceLanguage
        });

        translations[lang] = {
          ...post,
          title: titleTranslation.translatedText,
          content: contentTranslation.translatedText,
          category: categoryTranslation.translatedText,
          language: lang,
          translatedFrom: sourceLanguage
        };
        console.log('translations', translations);
      } catch (error) {
        console.error(`Failed to translate to ${lang}:`, error);
        translations[lang] = {
          ...post,
          language: lang,
          translatedFrom: sourceLanguage
        };
      }
    }

    return translations;
  }

  static async translateAndSavePost(options: TranslateAndSaveOptions) {
    const {
      post,
      postsDB,
      identity,
      mediaIds = [],
      timestamps = { createdAt: Date.now(), updatedAt: Date.now() },
      onStatusUpdate
    } = options;

    if (!get(aiApiKey) || !get(aiApiUrl)) {
      return {
        success: false,
        error: 'translation_config_missing',
        translationStatuses: {}
      };
    }

    const translationStatuses = {};
    
    try {
      const translations = await this.translatePost(post, onStatusUpdate);

      // Save translations
      for (const [lang, translatedPost] of Object.entries(translations)) {
        try {
          const _id = crypto.randomUUID();
          await postsDB.put({
            _id,
            ...translatedPost,
            createdAt: timestamps.createdAt,
            updatedAt: timestamps.updatedAt,
            identity: identity.id,
            mediaIds,
          });
          translationStatuses[lang] = 'success';
        } catch (error) {
          console.error(`Error saving translation for ${lang}:`, error);
          translationStatuses[lang] = 'error';
        }
      }

      return {
        success: true,
        translationStatuses
      };
    } catch (error) {
      console.error('Translation error:', error);
      return {
        success: false,
        error: 'translation_failed',
        translationStatuses: Object.fromEntries(
          [...get(enabledLanguages)].map(lang => [lang, 'error'])
        )
      };
    }
  }
} 