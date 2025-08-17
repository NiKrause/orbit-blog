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
      console.log(`🤖 AI TRANSLATOR BOT ACTIVATED! 🤖`);
      console.log(`🌍 Translating from ${request.sourceLanguage || 'auto-detect'} ➡️ ${request.targetLanguage}`);
      console.log(`💬 Text length: ${request.text.length} characters`);
      console.log('🗣️ Preview:', request.text.substring(0, 50) + (request.text.length > 50 ? '...' : ''));
      
      info(`Starting translation from ${request.sourceLanguage || 'auto'} to ${request.targetLanguage}`);
      const client = this.getClient();
      
      console.log('🧠 Preparing the AI brain for linguistic gymnastics...');
      
      const systemPrompt = `You are a professional translator. Translate the given text from ${request.sourceLanguage || 'the source language'} to ${request.targetLanguage}. 
Maintain the original meaning, tone, and formatting.
Preserve any technical terms, proper nouns, or specialized vocabulary.
Preserve any markdown formatting in the translation.
Only respond with the translated text, without any additional commentary.`;

      console.log('📞 Calling the AI overlords at OpenAI/DeepSeek...');
      console.log('⏳ *elevator music plays while AI thinks*');
      
      const completion = await client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.text }
        ],
        model: "deepseek-chat",
      });

      console.log('✨ MAGICAL TRANSLATION COMPLETE! ✨');
      console.log('🎉 AI has worked its magic!');
      console.log('💬 Translated text preview:', (completion.choices[0].message.content || '').substring(0, 50) + '...');
      
      info(`Successfully translated text to ${request.targetLanguage}`);
      return {
        translatedText: completion.choices[0].message.content || '',
      };
    } catch (_error) {
      console.log('💥 TRANSLATION EXPLOSION! 💥');
      console.log('😵 AI translator has fainted!');
      console.log('🔧 Error details:', _error);
      error('Translation error:', _error);
      throw _error;
    }
  }

  private static async getExistingTranslations(originalPostId: string, postsDB: any): Promise<Set<string>> {
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
      encryptionPassword,
      forceRetranslate = false
    } = options;

    console.log('🎪 WELCOME TO THE TRANSLATION CIRCUS! 🎪');
    console.log('🎭 Ladies and gentlemen, step right up!');
    console.log('🎟️ Translation Service has been summoned!');
    info(`Starting translation process for post ${post._id || 'new post'}`);
    console.log('📋 Translation request details:');
    console.log('   📝 Post ID:', post._id);
    console.log('   🎪 Title:', post.title);
    console.log('   🌍 Source Language:', post.language);
    console.log('   📏 Content Length:', post.content?.length || 0, 'characters');
    console.log('   🔐 Encrypted:', post.isEncrypted);

    console.log('🔑 Checking API credentials...');
    if (!get(aiApiKey) || !get(aiApiUrl)) {
      console.log('🚨 ALERT! ALERT! API credentials are missing! 🚨');
      console.log('😱 No API key or URL found! Translation impossible!');
      console.log('💔 The circus cannot perform without its magic keys!');
      error('Translation configuration missing - API key or URL not set');
      return {
        success: false,
        error: 'translation_config_missing',
        translationStatuses: {}
      };
    }
    
    console.log('✅ API credentials found! The show can go on!');
    console.log('🎪 Setting up the translation big top...');

    const translationStatuses = {};
    const enabledLangs = get(enabledLanguages);
    const sourceLanguage = post.language || 'en';
    
    info(`Source language: ${sourceLanguage}, Target languages: ${Array.from(enabledLangs).join(', ')}`);
    
    try {
      console.log('🔍 Detective mode: Looking for existing translations...');
      const existingTranslations = await this.getExistingTranslations(post._id, postsDB);
      console.log('🕵️ Found existing translations for:', Array.from(existingTranslations));
      
      if (forceRetranslate) {
        console.log('🔥 FORCE RE-TRANSLATE MODE ACTIVATED! 🔥');
        console.log('💪 Ignoring existing translations - full re-translation requested!');
        console.log('🗑️ Existing translations will be overwritten!');
      }
      
      console.log('🎯 Target languages locked and loaded:', Array.from(enabledLangs));
      console.log('🚀 Starting the translation marathon!');
      
      for (const lang of enabledLangs) {
        console.log(`\n🎪 === ROUND ${Array.from(enabledLangs).indexOf(lang) + 1}: ${lang.toUpperCase()} TRANSLATION ARENA === 🎪`);
        
        if (lang === sourceLanguage) {
          console.log(`😴 Skipping ${lang} - this is the source language`);
          console.log('💤 Moving on to next language...');
          info(`Skipping translation for ${lang} - source language`);
          translationStatuses[lang] = 'exists';
          if (onStatusUpdate) onStatusUpdate(lang, 'exists');
          continue;
        }
        
        if (!forceRetranslate && existingTranslations.has(lang)) {
          console.log(`😴 Skipping ${lang} - translation already exists (use force re-translate to override)`);
          console.log('💤 Moving on to next language...');
          info(`Skipping translation for ${lang} - already exists`);
          translationStatuses[lang] = 'exists';
          if (onStatusUpdate) onStatusUpdate(lang, 'exists');
          continue;
        }

        try {
          console.log(`🎬 ACTION! Starting ${lang} translation sequence!`);
          console.log('🎯 Target acquired! Preparing translation weapons...');
          info(`Starting translation to ${lang}`);
          if (onStatusUpdate) onStatusUpdate(lang, 'processing');

          console.log('🤖 Deploying AI translation squad...');
          const translatedPost = await this.translateSingleLanguage(post, lang, sourceLanguage);
          console.log('✨ Translation magic complete! Creating post record...');
          
          info(`Successfully translated post to ${lang}, saving to database`);
          
          const _id = crypto.randomUUID();
          console.log('🎲 Generated new post ID:', _id);
          
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
            console.log('🔐 ENCRYPTION MODE: Scrambling the translation!');
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
            console.log('🔒 Post encrypted and secured!');
          }

          console.log('💾 Saving to OrbitDB database...');
          await postsDB.put(postData);
          console.log('🎯 BULLSEYE! Post saved successfully!');
          info(`Successfully saved ${lang} translation with ID: ${_id}`);
          translationStatuses[lang] = 'success';
          
          // Switch to the newly translated language immediately
          console.log(`🌐 Switching to ${lang} language interface...`);
          setLanguage(lang);
          console.log('✅ Language switched! Welcome to the new world!');
          
          if (onStatusUpdate) onStatusUpdate(lang, 'success');
        } catch (_error) {
          console.log(`💥 BOOM! ${lang} translation crashed and burned!`);
          console.log('🚑 Emergency protocols activated!');
          console.log('⚠️ Error details:', _error);
          error(`Error processing translation for ${lang}:`, _error);
          translationStatuses[lang] = 'error';
          if (onStatusUpdate) onStatusUpdate(lang, 'error');
        }
      }
      
      console.log('\n🏁 TRANSLATION MARATHON COMPLETE! 🏁');
      console.log('📊 Final scores:', translationStatuses);

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