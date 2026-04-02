import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(__dirname, '../src/lib/i18n');

const KEYS = [
  'ai_toggle_show',
  'ai_toggle_hide',
  'ai_panel_title',
  'ai_panel_placeholder',
  'ai_model_section_label',
  'ai_model_kling_v3_pro_i2v',
  'ai_model_kling_v3_std_i2v',
  'ai_credential_section_label',
  'ai_credential_base_url',
  'ai_credential_api_key',
  'ai_credential_save',
  'ai_credential_saving',
  'ai_credential_db_not_ready',
  'ai_credential_validation_url',
  'ai_credential_validation_key',
  'ai_credential_save_error',
  'ai_credential_change_key',
  'ai_credential_key_saved_aria',
  'ai_credential_key_saved_with_mask',
  'ai_credential_validation_model',
  'ai_credential_decrypt_failed',
  'ai_schema_section_label',
  'ai_schema_field_prompt',
  'ai_schema_field_image_url',
  'ai_schema_field_duration',
  'ai_schema_field_required',
  'ai_schema_field_invalid_number',
  'ai_schema_field_invalid_integer',
  'ai_schema_field_below_minimum',
  'ai_schema_field_above_maximum',
  'ai_schema_field_invalid_enum',
  'ai_schema_manifest_unsupported',
  'ai_schema_manifest_invalid',
  'ai_image_upload',
  'ai_image_uploading',
  'ai_image_pick_library',
  'ai_image_media_not_ready',
  'ai_image_selected_label',
  'ai_image_pick_aria',
  'ai_run_generation',
  'ai_job_running_action',
  'ai_job_status_queued',
  'ai_job_status_running',
  'ai_job_status_succeeded',
  'ai_job_result_url_hint',
  'ai_job_error_network',
  'ai_job_error_auth',
  'ai_job_error_forbidden',
  'ai_job_error_rate_limit',
  'ai_job_error_http_client',
  'ai_job_error_http_server',
  'ai_job_error_cors_or_blocked',
  'ai_job_error_unknown',
  'ai_job_error_poll_failed',
  'ai_job_error_bad_response',
  'ai_job_error_timeout',
  'ai_import_video_to_library',
  'ai_import_video_importing',
  'ai_video_insert_into_post',
  'ai_video_add_to_selected_media',
  'ai_ingest_error_network',
  'ai_ingest_error_cors_or_blocked',
  'ai_ingest_error_http',
  'ai_ingest_error_too_large',
] as const;

describe('PostForm AI i18n keys (stories 3.x–5.2)', () => {
  for (const file of readdirSync(i18nDir).filter((f) => f.endsWith('.js'))) {
    it(`${file} defines AI PostForm keys`, async () => {
      const mod = await import(`../src/lib/i18n/${file}`);
      const dict = mod.default as Record<string, string>;
      for (const k of KEYS) {
        assert.ok(
          typeof dict[k] === 'string' && dict[k].length > 0,
          `missing or empty ${k}`,
        );
      }
    });
  }
});
