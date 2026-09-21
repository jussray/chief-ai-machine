import { describe, expect, it } from 'vitest';

import { buildFounderContentVisualDirection } from './founder-content-visual-direction.js';

const movingInput = {
  creative_mode: 'cinematic-proof',
  form: 'short-video-9x16',
  emotional_intent: ['wonder', 'revelation'],
  visual_hook: 'A founder moves through a bright workspace while one verified decision becomes visible.',
  scene_concept: 'Show clarity emerging through real action, spatial movement, and one evidence-bearing product interaction.',
  motion_language: 'Purposeful tracking, one restrained push-in, environmental motion, then a stable exit frame.',
  memory_line: 'One verified next move.',
  human_outcome: 'Help the viewer understand that the system narrows noisy project state into a defensible next action.',
  proof_object: 'Verified product capture',
  proof_truth_boundary: 'The product capture proves only the observed runtime behavior shown in the recording.',
  targets: ['linkedin', 'youtube-shorts'],
  preserves_human_agency: true,
  uses_manipulative_dark_patterns: false,
};

describe('founder video direction LEEVIZE contract', () => {
  it('routes moving media through provider-neutral Shot DNA and open-source-first post', () => {
    const result = buildFounderContentVisualDirection(movingInput, {
      thesis: 'Founder Control Room helps a founder choose one verified next action from current project evidence.',
    });

    expect(result.video_workflow).toMatchObject({
      workflow: 'LEEVIZE',
      shot_contract: 'shot-dna@v1',
      open_source_first: true,
      candidate_availability_is_runtime_fact: true,
      open_source_label_does_not_prove_license_or_commercial_use: true,
      unknown_license_classify_as: 'BLOCKED_LICENSE_REVIEW',
      renderer_adapters_replaceable: true,
      generated_ui_may_prove_product_behavior: false,
      real_product_capture_requires_playwright: true,
      final_audio_precedes_caption_timing: true,
    });
    expect(result.video_workflow.compile_order).toEqual([
      'director-brief',
      'model-neutral-shot-spec',
      'renderer-adapter',
    ]);
    expect(result.video_workflow.deterministic_post_tools).toEqual(['ffmpeg', 'ffprobe']);
    expect(result.video_workflow.authority.routing_preference_only).toBe(true);
    expect(result.video_workflow.authority.may_authorize_publish).toBe(false);
  });

  it('uses ATTACK6000 as deduplicated reasoning pressure, not a fake external-test count', () => {
    const result = buildFounderContentVisualDirection(movingInput, {
      thesis: 'Current evidence must bound public product claims.',
    });

    expect(result.video_workflow.attack_6000.reasoning_pressure_budget).toBe(6000);
    expect(result.video_workflow.attack_6000.external_test_count_claimed).toBe(false);
    expect(result.video_workflow.attack_6000.deduplicate_failure_classes).toBe(true);
    for (const family of ['story', 'continuity', 'product-truth', 'audio', 'captions', 'provenance', 'release']) {
      expect(result.video_workflow.attack_6000.required_families).toContain(family);
    }
  });

  it('does not attach a video workflow to a still-image form', () => {
    const result = buildFounderContentVisualDirection({
      ...movingInput,
      form: 'hero-still-4x5',
      motion_language: '',
    }, {
      thesis: 'A still visual can carry the proof object without pretending to be motion.',
    });

    expect(result.video_workflow).toBeNull();
  });
});
