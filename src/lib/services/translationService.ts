import { get } from 'svelte/store';
import { aiApiKey, aiApiUrl, enabledLanguages } from '../store.js';
import type { BlogPost } from '../types.js';
import OpenAI from 'openai';
import { encryptPost } from '$lib/cryptoUtils.js';
import { info, error } from '../utils/logger.js'
import { setLanguage } from '../i18n/index.js';

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
    _id?: string;
    title: string;
    content: string;
    category: string;
    language: string;
    isEncrypted?: boolean;
  };
  encryptionPassword?: string;
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
      info(`Starting translation from ${request.sourceLanguage || 'auto'} to ${request.targetLanguage}`);
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

      info(`Successfully translated text to ${request.targetLanguage}`);
      return {
        translatedText: completion.choices[0].message.content || '',
      };
    } catch (_error) {
      error('Translation error:', _error);
      throw error;
    }
  }

  private static async getExistingTranslations(originalPostId: string): Promise<Set<string>> {
    try {
      info(`Fetching existing translations for post ${originalPostId}`);
      const allPosts = await postsDB.all();
      const translations = allPosts
        .filter(entry => entry.value.originalPostId === originalPostId)
        .map(entry => entry.value.language);
      
      info(`Found ${translations.length} existing translations for post ${originalPostId}`);
      return new Set(translations);
    } catch (_error) {
      error('Error getting existing translations:', _error);
      return new Set();
    }
  }

  private static async translateSingleLanguage(
    post: BlogPost, 
    targetLang: string, 
    sourceLang: string
  ): Promise<BlogPost> {
    info(`Translating post fields to ${targetLang}`);
    
    // Translate title
    const titleTranslation = await this.translate({
      text: post.title,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang
    });

    // Translate content
    const contentTranslation = await this.translate({
      text: post.content,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang
    });

    // Translate category
    const categoryTranslation = await this.translate({
      text: post.category,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang
    });

    // Only include the fields we actually need, don't spread the original post
    const translatedPost = {
      title: titleTranslation.translatedText,
      content: contentTranslation.translatedText,
      category: categoryTranslation.translatedText,
      language: targetLang,
      translatedFrom: sourceLang,
      isEncrypted: post.isEncrypted || false
    };

    // Validate that all required fields are present
    if (!translatedPost.title || !translatedPost.content || !translatedPost.category) {
      error(`Translation validation failed for ${targetLang}`, {
        hasTitle: !!translatedPost.title,
        hasContent: !!translatedPost.content,
        hasCategory: !!translatedPost.category
      });
      throw new Error(`Translation failed: missing required fields for ${targetLang}`);
    }

    info(`Successfully translated all fields to ${targetLang}`);
    return translatedPost as BlogPost;
  }

  static async translateAndSavePost(options: TranslateAndSaveOptions) {
    const {
      post,
      postsDB,
      identity,
      mediaIds = [],
      timestamps = { createdAt: Date.now(), updatedAt: Date.now() },
      onStatusUpdate,
      encryptionPassword
    } = options;

    info(`Starting translation process for post ${post._id || 'new post'}`);

    if (!get(aiApiKey) || !get(aiApiUrl)) {
      error('Translation configuration missing - API key or URL not set');
      return {
        success: false,
        error: 'translation_config_missing',
        translationStatuses: {}
      };
    }

    const translationStatuses = {};
    const enabledLangs = get(enabledLanguages);
    const sourceLanguage = post.language || 'en';
    
    info(`Source language: ${sourceLanguage}, Target languages: ${Array.from(enabledLangs).join(', ')}`);
    
    try {
      const existingTranslations = await this.getExistingTranslations(post._id);
      
      for (const lang of enabledLangs) {
        if (lang === sourceLanguage || existingTranslations.has(lang)) {
          info(`Skipping translation for ${lang} - already exists or source language`);
          translationStatuses[lang] = 'exists';
          if (onStatusUpdate) onStatusUpdate(lang, 'exists');
          continue;
        }

        try {
          info(`Starting translation to ${lang}`);
          if (onStatusUpdate) onStatusUpdate(lang, 'processing');

          const translatedPost = await this.translateSingleLanguage(post, lang, sourceLanguage);
          
          info(`Successfully translated post to ${lang}, saving to database`);
          
          const _id = crypto.randomUUID();
          let postData = {
            _id,
            title: translatedPost.title,
            content: translatedPost.content,
            category: translatedPost.category,
            language: translatedPost.language,
            translatedFrom: translatedPost.translatedFrom,
            createdAt: timestamps.createdAt,
            updatedAt: timestamps.updatedAt,
            identity: identity.id,
            mediaIds: mediaIds || [],
            originalPostId: post._id || null,
            isEncrypted: translatedPost.isEncrypted || false
          };

          if (post.isEncrypted && encryptionPassword) {
            info(`Encrypting translated post for ${lang}`);
            const encryptedData = await encryptPost(
              { title: translatedPost.title, content: translatedPost.content }, 
              encryptionPassword
            );
            postData = {
              ...postData,
              title: encryptedData.encryptedTitle,
              content: encryptedData.encryptedContent,
              isEncrypted: true
            };
          }

          await postsDB.put(postData);
          info(`Successfully saved ${lang} translation with ID: ${_id}`);
          translationStatuses[lang] = 'success';
          
          // Switch to the newly translated language immediately
          setLanguage(lang);
          
          if (onStatusUpdate) onStatusUpdate(lang, 'success');
        } catch (_error) {
          error(`Error processing translation for ${lang}:`, _error);
          translationStatuses[lang] = 'error';
          if (onStatusUpdate) onStatusUpdate(lang, 'error');
        }
      }

      info(`Translation process completed. Results: ${JSON.stringify(translationStatuses)}`);
      return {
        success: true,
        translationStatuses
      };
    } catch (_error) {
      error('Translation process failed:', _error);
      return {
        success: false,
        error: 'translation_failed',
        translationStatuses: Object.fromEntries(
          [...enabledLangs].map(lang => [lang, 'error'])
        )
      };
    }
  }
} 