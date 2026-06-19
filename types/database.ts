// Handwritten Database type derived from supabase/migrations/*.sql (Phase 1–2).
// Layout matches `supabase gen types typescript` output so this file can be
// regenerated in-place once Docker Desktop is installed:
//   npm run db:types
// Until then, keep this file in sync with new migrations by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          role: 'professor' | 'student'
          student_id: string | null
          language: 'ko' | 'en' | 'ja'
          email_notify: boolean
          push_notify: boolean
          kakao_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: 'professor' | 'student'
          student_id?: string | null
          language?: 'ko' | 'en' | 'ja'
          email_notify?: boolean
          push_notify?: boolean
          kakao_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          role?: 'professor' | 'student'
          student_id?: string | null
          language?: 'ko' | 'en' | 'ja'
          email_notify?: boolean
          push_notify?: boolean
          kakao_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          professor_id: string
          name: string
          semester: string
          invite_code: string
          is_active: boolean
          current_grammar_focus: string | null
          created_at: string
        }
        Insert: {
          id?: string
          professor_id: string
          name: string
          semester: string
          invite_code: string
          is_active?: boolean
          current_grammar_focus?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          professor_id?: string
          name?: string
          semester?: string
          invite_code?: string
          is_active?: boolean
          current_grammar_focus?: string | null
          created_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          class_id: string
          student_id: string
          enrolled_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          enrolled_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
          enrolled_at?: string
        }
        Relationships: []
      }
      corpus_documents: {
        Row: {
          id: string
          class_id: string
          professor_id: string
          file_name: string
          file_type: 'pdf' | 'txt' | 'docx'
          content: string
          title: string | null
          description: string | null
          is_public: boolean
          download_count: number
          avg_rating: number
          rating_count: number
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          professor_id: string
          file_name: string
          file_type: 'pdf' | 'txt' | 'docx'
          content: string
          title?: string | null
          description?: string | null
          is_public?: boolean
          download_count?: number
          avg_rating?: number
          rating_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          professor_id?: string
          file_name?: string
          file_type?: 'pdf' | 'txt' | 'docx'
          content?: string
          title?: string | null
          description?: string | null
          is_public?: boolean
          download_count?: number
          avg_rating?: number
          rating_count?: number
          created_at?: string
        }
        Relationships: []
      }
      chapter_prompts: {
        Row: {
          id: string
          class_id: string
          chapter_number: number
          system_prompt: string
          icl_examples: Json
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          chapter_number: number
          system_prompt: string
          icl_examples?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          chapter_number?: number
          system_prompt?: string
          icl_examples?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rubrics: {
        Row: {
          id: string
          professor_id: string
          name: string
          criteria: Json
          created_at: string
        }
        Insert: {
          id?: string
          professor_id: string
          name: string
          criteria?: Json
          created_at?: string
        }
        Update: {
          id?: string
          professor_id?: string
          name?: string
          criteria?: Json
          created_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          class_id: string
          professor_id: string
          title: string
          prompt_text: string
          due_date: string | null
          rubric_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          professor_id: string
          title: string
          prompt_text: string
          due_date?: string | null
          rubric_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          professor_id?: string
          title?: string
          prompt_text?: string
          due_date?: string | null
          rubric_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          student_id: string
          class_id: string
          chapter_number: number
          draft_text: string | null
          revision_text: string | null
          draft_error_count: number | null
          revision_error_count: number | null
          assignment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          chapter_number: number
          draft_text?: string | null
          revision_text?: string | null
          draft_error_count?: number | null
          revision_error_count?: number | null
          assignment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          chapter_number?: number
          draft_text?: string | null
          revision_text?: string | null
          draft_error_count?: number | null
          revision_error_count?: number | null
          assignment_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      error_cards: {
        Row: {
          id: string
          session_id: string
          student_id: string
          chapter_number: number
          error_span: string
          error_type: 'vocab' | 'grammar'
          error_subtype: string | null
          correction: string | null
          explanation: string | null
          cot_reasoning: Json
          similar_example: string | null
          hsk_level: number | null
          is_resolved: boolean
          fossilization_count: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          student_id: string
          chapter_number: number
          error_span: string
          error_type: 'vocab' | 'grammar'
          error_subtype?: string | null
          correction?: string | null
          explanation?: string | null
          cot_reasoning?: Json
          similar_example?: string | null
          hsk_level?: number | null
          is_resolved?: boolean
          fossilization_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          student_id?: string
          chapter_number?: number
          error_span?: string
          error_type?: 'vocab' | 'grammar'
          error_subtype?: string | null
          correction?: string | null
          explanation?: string | null
          cot_reasoning?: Json
          similar_example?: string | null
          hsk_level?: number | null
          is_resolved?: boolean
          fossilization_count?: number
          created_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          id: string
          student_id: string
          error_card_id: string | null
          sentence: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          error_card_id?: string | null
          sentence: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          error_card_id?: string | null
          sentence?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      vocabulary: {
        Row: {
          id: string
          student_id: string
          chinese: string
          pinyin: string | null
          korean: string | null
          source_error_id: string | null
          review_count: number
          next_review_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          chinese: string
          pinyin?: string | null
          korean?: string | null
          source_error_id?: string | null
          review_count?: number
          next_review_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          chinese?: string
          pinyin?: string | null
          korean?: string | null
          source_error_id?: string | null
          review_count?: number
          next_review_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          id: string
          student_id: string
          error_card_id: string
          is_correct: boolean
          answered_at: string
        }
        Insert: {
          id?: string
          student_id: string
          error_card_id: string
          is_correct: boolean
          answered_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          error_card_id?: string
          is_correct?: boolean
          answered_at?: string
        }
        Relationships: []
      }
      translation_logs: {
        Row: {
          id: string
          student_id: string
          original_text: string
          deepl_result: string | null
          papago_result: string | null
          gpt_result: string | null
          claude_analysis: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          original_text: string
          deepl_result?: string | null
          papago_result?: string | null
          gpt_result?: string | null
          claude_analysis?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          original_text?: string
          deepl_result?: string | null
          papago_result?: string | null
          gpt_result?: string | null
          claude_analysis?: string | null
          created_at?: string
        }
        Relationships: []
      }
      url_analysis_logs: {
        Row: {
          id: string
          student_id: string
          url: string
          source_type: 'news' | 'weibo' | 'xiaohongshu' | 'other' | null
          content_text: string | null
          analysis_result: Json
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          url: string
          source_type?: 'news' | 'weibo' | 'xiaohongshu' | 'other' | null
          content_text?: string | null
          analysis_result?: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          url?: string
          source_type?: 'news' | 'weibo' | 'xiaohongshu' | 'other' | null
          content_text?: string | null
          analysis_result?: Json
          created_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          student_id: string
          badge_type: string
          badge_name: string
          badge_icon: string | null
          earned_at: string
        }
        Insert: {
          id?: string
          student_id: string
          badge_type: string
          badge_name: string
          badge_icon?: string | null
          earned_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          badge_type?: string
          badge_name?: string
          badge_icon?: string | null
          earned_at?: string
        }
        Relationships: []
      }
      gamification_stats: {
        Row: {
          id: string
          student_id: string
          level: number
          xp: number
          streak_days: number
          last_active_date: string | null
          activity_coins: number
          mastery_points: number
          streak_protectors: number
          last_protector_grant_date: string | null
          longest_streak: number
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          level?: number
          xp?: number
          streak_days?: number
          last_active_date?: string | null
          activity_coins?: number
          mastery_points?: number
          streak_protectors?: number
          last_protector_grant_date?: string | null
          longest_streak?: number
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          level?: number
          xp?: number
          streak_days?: number
          last_active_date?: string | null
          activity_coins?: number
          mastery_points?: number
          streak_protectors?: number
          last_protector_grant_date?: string | null
          longest_streak?: number
          updated_at?: string
        }
        Relationships: []
      }
      learning_goals: {
        Row: {
          id: string
          student_id: string
          class_id: string | null
          goal_type: 'error_type' | 'error_count' | 'vocab_count'
          target_value: string
          current_value: number
          deadline: string | null
          is_achieved: boolean
          updated_at: string
          achieved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id?: string | null
          goal_type: 'error_type' | 'error_count' | 'vocab_count'
          target_value: string
          current_value?: number
          deadline?: string | null
          is_achieved?: boolean
          updated_at?: string
          achieved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string | null
          goal_type?: 'error_type' | 'error_count' | 'vocab_count'
          target_value?: string
          current_value?: number
          deadline?: string | null
          is_achieved?: boolean
          updated_at?: string
          achieved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rubric_evaluations: {
        Row: {
          id: string
          session_id: string
          rubric_id: string
          scores: Json
          total_score: number | null
          ai_feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          rubric_id: string
          scores?: Json
          total_score?: number | null
          ai_feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          rubric_id?: string
          scores?: Json
          total_score?: number | null
          ai_feedback?: string | null
          created_at?: string
        }
        Relationships: []
      }
      weekly_cardnews: {
        Row: {
          id: string
          student_id: string
          class_id: string | null
          week_start: string
          card1_data: Json
          card2_data: Json
          card3_data: Json
          card4_data: Json
          goal_progress: Json
          is_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id?: string | null
          week_start: string
          card1_data?: Json
          card2_data?: Json
          card3_data?: Json
          card4_data?: Json
          goal_progress?: Json
          is_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string | null
          week_start?: string
          card1_data?: Json
          card2_data?: Json
          card3_data?: Json
          card4_data?: Json
          goal_progress?: Json
          is_sent?: boolean
          created_at?: string
        }
        Relationships: []
      }
      professor_reports: {
        Row: {
          id: string
          professor_id: string
          class_id: string
          week_start: string
          focus_points: Json
          praise_students: Json
          care_students: Json
          fossilization_alerts: Json
          next_class_suggestion: string | null
          metrics: Json
          created_at: string
        }
        Insert: {
          id?: string
          professor_id: string
          class_id: string
          week_start: string
          focus_points?: Json
          praise_students?: Json
          care_students?: Json
          fossilization_alerts?: Json
          next_class_suggestion?: string | null
          metrics?: Json
          created_at?: string
        }
        Update: {
          id?: string
          professor_id?: string
          class_id?: string
          week_start?: string
          focus_points?: Json
          praise_students?: Json
          care_students?: Json
          fossilization_alerts?: Json
          next_class_suggestion?: string | null
          metrics?: Json
          created_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          student_id: string
          endpoint: string
          subscription: Json
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          endpoint: string
          subscription: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          endpoint?: string
          subscription?: Json
          created_at?: string
        }
        Relationships: []
      }
      lti_platforms: {
        Row: {
          id: string
          professor_id: string | null
          class_id: string | null
          name: string
          issuer: string
          client_id: string
          deployment_id: string | null
          auth_login_url: string
          auth_token_url: string
          jwks_uri: string
          created_at: string
        }
        Insert: {
          id?: string
          professor_id?: string | null
          class_id?: string | null
          name: string
          issuer: string
          client_id: string
          deployment_id?: string | null
          auth_login_url: string
          auth_token_url: string
          jwks_uri: string
          created_at?: string
        }
        Update: {
          id?: string
          professor_id?: string | null
          class_id?: string | null
          name?: string
          issuer?: string
          client_id?: string
          deployment_id?: string | null
          auth_login_url?: string
          auth_token_url?: string
          jwks_uri?: string
          created_at?: string
        }
        Relationships: []
      }
      lti_login_states: {
        Row: {
          state: string
          nonce: string
          issuer: string
          created_at: string
        }
        Insert: {
          state: string
          nonce: string
          issuer: string
          created_at?: string
        }
        Update: {
          state?: string
          nonce?: string
          issuer?: string
          created_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          professor_id: string
          key_hash: string
          name: string
          scopes: string[]
          last_used_at: string | null
          rate_window_start: string | null
          rate_window_count: number
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          professor_id: string
          key_hash: string
          name: string
          scopes?: string[]
          last_used_at?: string | null
          rate_window_start?: string | null
          rate_window_count?: number
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          professor_id?: string
          key_hash?: string
          name?: string
          scopes?: string[]
          last_used_at?: string | null
          rate_window_start?: string | null
          rate_window_count?: number
          created_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          id: string
          class_id: string
          professor_id: string
          grammar_focus: string | null
          started_at: string
          ended_at: string | null
          summary: Json
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          professor_id: string
          grammar_focus?: string | null
          started_at?: string
          ended_at?: string | null
          summary?: Json
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          professor_id?: string
          grammar_focus?: string | null
          started_at?: string
          ended_at?: string | null
          summary?: Json
          created_at?: string
        }
        Relationships: []
      }
      corpus_ratings: {
        Row: {
          id: string
          corpus_document_id: string
          professor_id: string
          rating: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          corpus_document_id: string
          professor_id: string
          rating: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          corpus_document_id?: string
          professor_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pronunciation_sessions: {
        Row: {
          id: string
          student_id: string
          target_text: string
          recognized_text: string
          accuracy_score: number
          errors: Json
          language: 'en-US' | 'ko-KR'
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          target_text: string
          recognized_text: string
          accuracy_score: number
          errors?: Json
          language: 'en-US' | 'ko-KR'
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          target_text?: string
          recognized_text?: string
          accuracy_score?: number
          errors?: Json
          language?: 'en-US' | 'ko-KR'
          created_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          id: string
          user_id: string
          kakao_access_token_enc: string | null
          kakao_refresh_token_enc: string | null
          kakao_user_id: string | null
          enabled_events: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kakao_access_token_enc?: string | null
          kakao_refresh_token_enc?: string | null
          kakao_user_id?: string | null
          enabled_events?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kakao_access_token_enc?: string | null
          kakao_refresh_token_enc?: string | null
          kakao_user_id?: string | null
          enabled_events?: Json
          created_at?: string
        }
        Relationships: []
      }
      peer_review_requests: {
        Row: {
          id: string
          assignment_id: string
          requester_id: string
          status: 'pending' | 'in_progress' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          assignment_id: string
          requester_id: string
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          requester_id?: string
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
        Relationships: []
      }
      peer_reviews: {
        Row: {
          id: string
          request_id: string
          reviewer_id: string
          feedback_text: string | null
          grammar_score: number | null
          vocab_score: number | null
          content_score: number | null
          overall_score: number | null
          status: 'pending' | 'in_progress' | 'completed'
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          request_id: string
          reviewer_id: string
          feedback_text?: string | null
          grammar_score?: number | null
          vocab_score?: number | null
          content_score?: number | null
          overall_score?: number | null
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          request_id?: string
          reviewer_id?: string
          feedback_text?: string | null
          grammar_score?: number | null
          vocab_score?: number | null
          content_score?: number | null
          overall_score?: number | null
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          id: string
          student_id: string
          generated_at: string
          snapshot: Json
        }
        Insert: {
          id?: string
          student_id: string
          generated_at?: string
          snapshot: Json
        }
        Update: {
          id?: string
          student_id?: string
          generated_at?: string
          snapshot?: Json
        }
        Relationships: []
      }
      live_typing_consents: {
        Row: {
          id: string
          class_id: string
          student_id: string
          granted_at: string
          withdrawn_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          granted_at?: string
          withdrawn_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          student_id?: string
          granted_at?: string
          withdrawn_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      student_weekly_reports: {
        Row: {
          id: string
          student_id: string
          class_id: string
          week_start: string
          metrics: Json
          suggestions: Json
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          week_start: string
          metrics?: Json
          suggestions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          week_start?: string
          metrics?: Json
          suggestions?: Json
          created_at?: string
        }
        Relationships: []
      }
      in_app_notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          link_url: string | null
          payload: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string
          link_url?: string | null
          payload?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          link_url?: string | null
          payload?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      error_species: {
        Row: {
          id: string
          code: string
          category: 'vocab' | 'grammar'
          name_zh: string
          name_ko: string
          hsk_level: number | null
          description: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          category: 'vocab' | 'grammar'
          name_zh: string
          name_ko: string
          hsk_level?: number | null
          description?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          category?: 'vocab' | 'grammar'
          name_zh?: string
          name_ko?: string
          hsk_level?: number | null
          description?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      user_dex_entries: {
        Row: {
          id: string
          student_id: string
          species_id: string
          status: 'encountered' | 'tamed' | 'graduated'
          encounter_count: number
          first_encountered_at: string
          tamed_at: string | null
          graduated_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          species_id: string
          status?: 'encountered' | 'tamed' | 'graduated'
          encounter_count?: number
          first_encountered_at?: string
          tamed_at?: string | null
          graduated_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          species_id?: string
          status?: 'encountered' | 'tamed' | 'graduated'
          encounter_count?: number
          first_encountered_at?: string
          tamed_at?: string | null
          graduated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      error_type_streaks: {
        Row: {
          id: string
          student_id: string
          species_id: string
          no_error_days: number
          best_days: number
          last_advanced_date: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          species_id: string
          no_error_days?: number
          best_days?: number
          last_advanced_date?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          species_id?: string
          no_error_days?: number
          best_days?: number
          last_advanced_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reward_items: {
        Row: {
          id: string
          code: string
          category: 'sound_pack' | 'theme' | 'avatar' | 'sticker'
          name_ko: string
          name_zh: string
          rarity: 'common' | 'rare' | 'epic'
          icon: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          category: 'sound_pack' | 'theme' | 'avatar' | 'sticker'
          name_ko: string
          name_zh?: string
          rarity?: 'common' | 'rare' | 'epic'
          icon?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          category?: 'sound_pack' | 'theme' | 'avatar' | 'sticker'
          name_ko?: string
          name_zh?: string
          rarity?: 'common' | 'rare' | 'epic'
          icon?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      reward_inventory: {
        Row: {
          id: string
          student_id: string
          item_id: string
          acquired_at: string
        }
        Insert: {
          id?: string
          student_id: string
          item_id: string
          acquired_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          item_id?: string
          acquired_at?: string
        }
        Relationships: []
      }
      class_goals: {
        Row: {
          id: string
          class_id: string
          species_id: string
          title: string
          target_count: number
          current_count: number
          period_start: string
          period_end: string
          achieved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          species_id: string
          title?: string
          target_count: number
          current_count?: number
          period_start: string
          period_end: string
          achieved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          species_id?: string
          title?: string
          target_count?: number
          current_count?: number
          period_start?: string
          period_end?: string
          achieved?: boolean
          created_at?: string
        }
        Relationships: []
      }
      league_points: {
        Row: {
          id: string
          student_id: string
          class_id: string
          week_start: string
          points: number
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          week_start: string
          points?: number
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          week_start?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      mistake_feed: {
        Row: {
          id: string
          student_id: string
          original_ko: string
          literal_zh: string
          corrected_zh: string
          is_public: boolean
          likes: number
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          original_ko: string
          literal_zh: string
          corrected_zh?: string
          is_public?: boolean
          likes?: number
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          original_ko?: string
          literal_zh?: string
          corrected_zh?: string
          is_public?: boolean
          likes?: number
          created_at?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          id: string
          student_id: string
          quest_date: string
          source: Json
          missions: Json
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          quest_date: string
          source?: Json
          missions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          quest_date?: string
          source?: Json
          missions?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      professor_reports_latest: {
        Row: {
          id: string | null
          professor_id: string | null
          class_id: string | null
          week_start: string | null
          focus_points: Json | null
          praise_students: Json | null
          care_students: Json | null
          fossilization_alerts: Json | null
          next_class_suggestion: string | null
          metrics: Json | null
          created_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_professor: { Args: Record<string, never>; Returns: boolean }
      is_enrolled: { Args: { p_class_id: string }; Returns: boolean }
      owns_class: { Args: { p_class_id: string }; Returns: boolean }
      owns_session_class: { Args: { p_session_id: string }; Returns: boolean }
      corpus_class_id: { Args: { p_name: string }; Returns: string | null }
      compute_level: { Args: { p_xp: number }; Returns: number }
      add_xp: {
        Args: { p_student_id: string; p_delta: number }
        Returns: { new_level: number; new_xp: number; leveled_up: boolean }[]
      }
      touch_streak: {
        Args: { p_student_id: string }
        Returns: { streak_days: number; extended: boolean; was_reset: boolean }[]
      }
      refresh_corpus_rating_stats: {
        Args: { p_doc_id: string }
        Returns: undefined
      }
      increment_corpus_download: {
        Args: { p_doc_id: string }
        Returns: number
      }
      kakao_set_tokens: {
        Args: {
          p_user_id: string
          p_access: string | null
          p_refresh: string | null
          p_kakao_user_id: string | null
          p_key: string
        }
        Returns: undefined
      }
      kakao_get_tokens: {
        Args: { p_user_id: string; p_key: string }
        Returns: {
          access_token: string | null
          refresh_token: string | null
          kakao_user_id: string | null
          enabled_events: Json
        }[]
      }
      kakao_clear_tokens: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      award_currency: {
        Args: { p_student_id: string; p_activity_delta?: number; p_mastery_delta?: number }
        Returns: { activity_coins: number; mastery_points: number }[]
      }
      record_dex_encounter: {
        Args: { p_student_id: string; p_code: string }
        Returns: { status: 'encountered' | 'tamed' | 'graduated'; encounter_count: number }[]
      }
      record_dex_graduation: {
        Args: { p_student_id: string; p_code: string }
        Returns: { newly_graduated: boolean }[]
      }
      grant_weekly_streak_protector: {
        Args: { p_student_id: string }
        Returns: { streak_protectors: number; granted: boolean }[]
      }
      consume_streak_protector: {
        Args: { p_student_id: string }
        Returns: { streak_protectors: number; consumed: boolean }[]
      }
      advance_error_type_streak: {
        Args: { p_student_id: string; p_code: string; p_had_error: boolean }
        Returns: { no_error_days: number; best_days: number }[]
      }
      pull_gacha: {
        Args: { p_student_id: string; p_cost: number }
        Returns: {
          item_code: string
          item_id: string
          rarity: 'common' | 'rare' | 'epic'
          is_duplicate: boolean
          activity_coins: number
        }[]
      }
      contribute_class_goal: {
        Args: { p_class_id: string; p_code: string }
        Returns: { current_count: number; target_count: number; achieved: boolean }[]
      }
      add_league_points: {
        Args: { p_student_id: string; p_class_id: string; p_week_start: string; p_points: number }
        Returns: number
      }
      get_league_standings: {
        Args: { p_class_id: string; p_week_start: string }
        Returns: { rank: number; points: number; anon_seed: string; is_me: boolean }[]
      }
      get_public_mistake_feed: {
        Args: { p_limit: number }
        Returns: {
          id: string
          original_ko: string
          literal_zh: string
          corrected_zh: string
          likes: number
          anon_seed: string
          is_me: boolean
          created_at: string
        }[]
      }
      register_push_subscription: {
        Args: { p_endpoint: string; p_subscription: Json }
        Returns: undefined
      }
      unregister_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
