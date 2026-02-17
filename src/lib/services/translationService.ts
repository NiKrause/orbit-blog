import { get } from 'svelte/store';
import { aiApiKey, aiApiUrl, enabledLanguages } from '../store.js';
import type { BlogPost } from '../types.js';
import OpenAI from 'openai';
import { encryptPost } from '$lib/cryptoUtils.js';
import { createLogger } from '../utils/logger.js'
import { setLanguage } from '../i18n/index.js';

const log = createLogger('translation');

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
  post: BlogPost;
  encryptionPassword?: string;
  postsDB: any;
  identity: any;
  mediaIds?: string[];
  timestamps?: {
    createdAt: number;
    updatedAt: number;
  };
  onStatusUpdate?: (lang: string, status: string) => void;
  isEncrypting?: boolean;
  forceRetranslate?: boolean;
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
      log.debug(`🤖 AI TRANSLATOR BOT ACTIVATED! 🤖`);
      log.debug(`🌍 Translating from ${request.sourceLanguage || 'auto-detect'} ➡️ ${request.targetLanguage}`);
      log.debug(`💬 Text length: ${request.text.length} characters`);
      log.debug('🗣️ Preview:', request.text.substring(0, 50) + (request.text.length > 50 ? '...' : ''));
      
      log.info(`Starting translation from ${request.sourceLanguage || 'auto'} to ${request.targetLanguage}`);
      const client = this.getClient();
      
      log.debug('🧠 Preparing the AI brain for linguistic gymnastics...');
      
      const systemPrompt = `You are a professional translator. Translate the given text from ${request.sourceLanguage || 'the source language'} to ${request.targetLanguage}. 
Maintain the original meaning, tone, and formatting.
Preserve any technical terms, proper nouns, or specialized vocabulary.
Preserve any markdown formatting in the translation.
Only respond with the translated text, without any additional commentary.`;

      log.debug('📞 Calling the AI overlords at OpenAI/DeepSeek...');
      log.debug('⏳ *elevator music plays while AI thinks*');
      
      const completion = await client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.text }
        ],
        model: "deepseek-chat",
      });

      log.debug('✨ MAGICAL TRANSLATION COMPLETE! ✨');
      log.debug('🎉 AI has worked its magic!');
      log.debug('💬 Translated text preview:', (completion.choices[0].message.content || '').substring(0, 50) + '...');
      
      log.info(`Successfully translated text to ${request.targetLanguage}`);
      return {
        translatedText: completion.choices[0].message.content || '',
      };
    } catch (_error) {
      log.debug('💥 TRANSLATION EXPLOSION! 💥');
      log.debug('😵 AI translator has fainted!');
      log.debug('🔧 Error details:', _error);
      log.error('Translation error:', _error);
      throw _error;
    }
  }

  private static async getExistingTranslations(originalPostId: string, postsDB: any): Promise<Set<string>> {
    try {
      log.info(`Fetching existing translations for post ${originalPostId}`);
      const allPosts = await postsDB.all();
      const translations = allPosts
        .filter(entry => entry.value.originalPostId === originalPostId)
        .map(entry => entry.value.language);
      
      log.info(`Found ${translations.length} existing translations for post ${originalPostId}`);
      return new Set(translations);
    } catch (_error) {
      log.error('Error getting existing translations:', _error);
      return new Set();
    }
  }

  private static async translateSingleLanguage(
    post: BlogPost, 
    targetLang: string, 
    sourceLang: string
  ): Promise<BlogPost> {
    log.info(`Translating post fields to ${targetLang}`);
    
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
      log.error(`Translation validation failed for ${targetLang}`, {
        hasTitle: !!translatedPost.title,
        hasContent: !!translatedPost.content,
        hasCategory: !!translatedPost.category
      });
      throw new Error(`Translation failed: missing required fields for ${targetLang}`);
    }

    log.info(`Successfully translated all fields to ${targetLang}`);
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
      encryptionPassword,
      forceRetranslate = false
    } = options;

    log.debug('🎪 WELCOME TO THE TRANSLATION CIRCUS! 🎪');
    log.debug('🎭 Ladies and gentlemen, step right up!');
    log.debug('🎟️ Translation Service has been summoned!');
    log.info(`Starting translation process for post ${post._id || 'new post'}`);
    log.debug('📋 Translation request details:');
    log.debug('   📝 Post ID:', post._id);
    log.debug('   🎪 Title:', post.title);
    log.debug('   🌍 Source Language:', post.language);
    log.debug('   📏 Content Length:', post.content?.length || 0, 'characters');
    log.debug('   🔐 Encrypted:', post.isEncrypted);

    log.debug('🔑 Checking API credentials...');
    if (!get(aiApiKey) || !get(aiApiUrl)) {
      log.debug('🚨 ALERT! ALERT! API credentials are missing! 🚨');
      log.debug('😱 No API key or URL found! Translation impossible!');
      log.debug('💔 The circus cannot perform without its magic keys!');
      log.error('Translation configuration missing - API key or URL not set');
      return {
        success: false,
        error: 'translation_config_missing',
        translationStatuses: {}
      };
    }
    
    log.debug('✅ API credentials found! The show can go on!');
    log.debug('🎪 Setting up the translation big top...');

    const translationStatuses = {};
    const enabledLangs = get(enabledLanguages);
    const sourceLanguage = post.language || 'en';
    
    log.info(`Source language: ${sourceLanguage}, Target languages: ${Array.from(enabledLangs).join(', ')}`);
    
    try {
      log.debug('🔍 Detective mode: Looking for existing translations...');
      const existingTranslations = await this.getExistingTranslations(post._id, postsDB);
      log.debug('🕵️ Found existing translations for:', Array.from(existingTranslations));
      
      if (forceRetranslate) {
        log.debug('🔥 FORCE RE-TRANSLATE MODE ACTIVATED! 🔥');
        log.debug('💪 Ignoring existing translations - full re-translation requested!');
        log.debug('🗑️ Existing translations will be overwritten!');
      }
      
      log.debug('🎯 Target languages locked and loaded:', Array.from(enabledLangs));
      log.debug('🚀 Starting the translation marathon!');
      
      for (const lang of enabledLangs) {
        log.debug(`\n🎪 === ROUND ${Array.from(enabledLangs).indexOf(lang) + 1}: ${lang.toUpperCase()} TRANSLATION ARENA === 🎪`);
        
        if (lang === sourceLanguage) {
          log.debug(`😴 Skipping ${lang} - this is the source language`);
          log.debug('💤 Moving on to next language...');
          log.info(`Skipping translation for ${lang} - source language`);
          translationStatuses[lang] = 'exists';
          if (onStatusUpdate) onStatusUpdate(lang, 'exists');
          continue;
        }
        
        if (!forceRetranslate && existingTranslations.has(lang)) {
          log.debug(`😴 Skipping ${lang} - translation already exists (use force re-translate to override)`);
          log.debug('💤 Moving on to next language...');
          log.info(`Skipping translation for ${lang} - already exists`);
          translationStatuses[lang] = 'exists';
          if (onStatusUpdate) onStatusUpdate(lang, 'exists');
          continue;
        }

        try {
          log.debug(`🎬 ACTION! Starting ${lang} translation sequence!`);
          log.debug('🎯 Target acquired! Preparing translation weapons...');
          log.info(`Starting translation to ${lang}`);
          if (onStatusUpdate) onStatusUpdate(lang, 'processing');

          log.debug('🤖 Deploying AI translation squad...');
          const translatedPost = await this.translateSingleLanguage(post, lang, sourceLanguage);
          log.debug('✨ Translation magic complete! Creating post record...');
          
          log.info(`Successfully translated post to ${lang}, saving to database`);
          
          const _id = crypto.randomUUID();
          log.debug('🎲 Generated new post ID:', _id);
          
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
            log.debug('🔐 ENCRYPTION MODE: Scrambling the translation!');
            log.info(`Encrypting translated post for ${lang}`);
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
            log.debug('🔒 Post encrypted and secured!');
          }

          log.debug('💾 Saving to OrbitDB database...');
          await postsDB.put(postData);
          log.debug('🎯 BULLSEYE! Post saved successfully!');
          log.info(`Successfully saved ${lang} translation with ID: ${_id}`);
          translationStatuses[lang] = 'success';
          
          // Switch to the newly translated language immediately
          log.debug(`🌐 Switching to ${lang} language interface...`);
          setLanguage(lang);
          log.debug('✅ Language switched! Welcome to the new world!');
          
          if (onStatusUpdate) onStatusUpdate(lang, 'success');
        } catch (_error) {
          log.debug(`💥 BOOM! ${lang} translation crashed and burned!`);
          log.debug('🚑 Emergency protocols activated!');
          log.debug('⚠️ Error details:', _error);
          log.error(`Error processing translation for ${lang}:`, _error);
          translationStatuses[lang] = 'error';
          if (onStatusUpdate) onStatusUpdate(lang, 'error');
        }
      }
      
      log.debug('\n🏁 TRANSLATION MARATHON COMPLETE! 🏁');
      log.debug('📊 Final scores:', translationStatuses);

      log.info(`Translation process completed. Results: ${JSON.stringify(translationStatuses)}`);
      return {
        success: true,
        translationStatuses
      };
    } catch (_error) {
      log.error('Translation process failed:', _error);
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