export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          cache_read_tokens: number | null;
          cache_write_tokens: number | null;
          cost_usd: number;
          created_at: string;
          day: string;
          error_code: string | null;
          id: number;
          input_tokens: number | null;
          latency_ms: number | null;
          model: string | null;
          output_tokens: number | null;
          purpose: string;
          quota: string | null;
          ref_id: string | null;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          cost_usd?: number;
          created_at?: string;
          day?: string;
          error_code?: string | null;
          id?: never;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          purpose: string;
          quota?: string | null;
          ref_id?: string | null;
          status: string;
          user_id?: string | null;
        };
        Update: {
          cache_read_tokens?: number | null;
          cache_write_tokens?: number | null;
          cost_usd?: number;
          created_at?: string;
          day?: string;
          error_code?: string | null;
          id?: never;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          purpose?: string;
          quota?: string | null;
          ref_id?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          created_at: string;
          question_id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          question_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          question_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "bank_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          anon_id: string | null;
          created_at: string;
          id: number;
          name: string;
          props: NonNullable<Json>;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          anon_id?: string | null;
          created_at?: string;
          id?: never;
          name: string;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Update: {
          anon_id?: string | null;
          created_at?: string;
          id?: never;
          name?: string;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          category?: string;
          created_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          agreed_at: string | null;
          avatar: string | null;
          created_at: string;
          id: string;
          last_notified_day: string | null;
          levels: string[];
          nickname: string;
          notify_hour: number;
          notify_on: boolean;
          onboarded_at: string | null;
          share_nickname: boolean;
          theme: string;
          topics: string[];
        };
        ComputedFields: never;
        Insert: {
          agreed_at?: string | null;
          avatar?: string | null;
          created_at?: string;
          id: string;
          last_notified_day?: string | null;
          levels?: string[];
          nickname: string;
          notify_hour?: number;
          notify_on?: boolean;
          onboarded_at?: string | null;
          share_nickname?: boolean;
          theme?: string;
          topics?: string[];
        };
        Update: {
          agreed_at?: string | null;
          avatar?: string | null;
          created_at?: string;
          id?: string;
          last_notified_day?: string | null;
          levels?: string[];
          nickname?: string;
          notify_hour?: number;
          notify_on?: boolean;
          onboarded_at?: string | null;
          share_nickname?: boolean;
          theme?: string;
          topics?: string[];
        };
        Relationships: [];
      };
      projects: {
        Row: {
          content: string;
          created_at: string;
          error_code: string | null;
          id: string;
          name: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          name: string;
          status?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          name?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_key: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth_key: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth_key?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      question_keys: {
        Row: {
          links: Json | null;
          model_answer: string;
          question_id: number;
          rubric: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          links?: Json | null;
          model_answer: string;
          question_id: number;
          rubric: NonNullable<Json>;
        };
        Update: {
          links?: Json | null;
          model_answer?: string;
          question_id?: number;
          rubric?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "bank_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: number;
          is_hidden: boolean;
          level: string | null;
          project_id: string | null;
          prompt: string;
          topic_id: string | null;
          trial_field: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: number;
          is_hidden?: boolean;
          level?: string | null;
          project_id?: string | null;
          prompt: string;
          topic_id?: string | null;
          trial_field?: string | null;
        };
        Update: {
          id?: number;
          is_hidden?: boolean;
          level?: string | null;
          project_id?: string | null;
          prompt?: string;
          topic_id?: string | null;
          trial_field?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          box: number | null;
          due_day: string;
          question_id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          box?: number | null;
          due_day: string;
          question_id: number;
          user_id: string;
        };
        Update: {
          box?: number | null;
          due_day?: string;
          question_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "bank_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          day: string;
          grade_model: string;
          id: string;
          ip_hash: string | null;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          trial_token: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          day: string;
          grade_model?: string;
          id?: string;
          ip_hash?: string | null;
          kind: string;
          pick?: string | null;
          question_id: number;
          status?: string;
          trial_token?: string | null;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          day?: string;
          grade_model?: string;
          id?: string;
          ip_hash?: string | null;
          kind?: string;
          pick?: string | null;
          question_id?: number;
          status?: string;
          trial_token?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "bank_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      shares: {
        Row: {
          created_at: string;
          id: string;
          nickname: string | null;
          score: number;
          session_id: string;
          streak: number;
          topic_name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          nickname?: string | null;
          score: number;
          session_id: string;
          streak?: number;
          topic_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nickname?: string | null;
          score?: number;
          session_id?: string;
          streak?: number;
          topic_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shares_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      topics: {
        Row: {
          field: string;
          id: string;
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          field: string;
          id: string;
          name: string;
          sort: number;
        };
        Update: {
          field?: string;
          id?: string;
          name?: string;
          sort?: number;
        };
        Relationships: [];
      };
      turn_keys: {
        Row: {
          expected_answer: string;
          turn_id: string;
        };
        ComputedFields: never;
        Insert: {
          expected_answer: string;
          turn_id: string;
        };
        Update: {
          expected_answer?: string;
          turn_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "turn_keys_turn_id_fkey";
            columns: ["turn_id"];
            isOneToOne: true;
            referencedRelation: "turn_states";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turn_keys_turn_id_fkey";
            columns: ["turn_id"];
            isOneToOne: true;
            referencedRelation: "turns";
            referencedColumns: ["id"];
          },
        ];
      };
      turns: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          feedback: Json | null;
          follow_up_prompt: string | null;
          grading_attempts: number;
          grading_started_at: string | null;
          id: string;
          idx: number;
          rating: number | null;
          score: number | null;
          session_id: string;
          status: string;
          verdict: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          feedback?: Json | null;
          follow_up_prompt?: string | null;
          grading_attempts?: number;
          grading_started_at?: string | null;
          id?: string;
          idx: number;
          rating?: number | null;
          score?: number | null;
          session_id: string;
          status?: string;
          verdict?: string | null;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          feedback?: Json | null;
          follow_up_prompt?: string | null;
          grading_attempts?: number;
          grading_started_at?: string | null;
          id?: string;
          idx?: number;
          rating?: number | null;
          score?: number | null;
          session_id?: string;
          status?: string;
          verdict?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "turns_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      bank_questions: {
        Row: {
          field: string;
          id: number;
          level: string | null;
          prompt: string;
          topic_id: string | null;
          trial_field: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      metrics_weekly: {
        Row: {
          answers: number | null;
          d7_cohort: number | null;
          d7_rate: number | null;
          d7_returned: number | null;
          first_answer_rate: number | null;
          first_visitors: number | null;
          first_visitors_answered: number | null;
          ratings: number | null;
          thumbs_up: number | null;
          thumbs_up_rate: number | null;
          week: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      turn_states: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          effective_status: string | null;
          feedback: Json | null;
          follow_up_prompt: string | null;
          grading_attempts: number;
          grading_started_at: string | null;
          id: string;
          idx: number;
          rating: number | null;
          score: number | null;
          session_id: string;
          status: string;
          verdict: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          effective_status?: never;
          feedback?: Json | null;
          follow_up_prompt?: string | null;
          grading_attempts?: number | null;
          grading_started_at?: string | null;
          id?: string | null;
          idx?: number | null;
          rating?: number | null;
          score?: number | null;
          session_id?: string | null;
          status?: string | null;
          verdict?: string | null;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          effective_status?: never;
          feedback?: Json | null;
          follow_up_prompt?: string | null;
          grading_attempts?: number | null;
          grading_started_at?: string | null;
          id?: string | null;
          idx?: number | null;
          rating?: number | null;
          score?: number | null;
          session_id?: string | null;
          status?: string | null;
          verdict?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "turns_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      adopt_trial: {
        Args: { p_trial_token: string; p_user_id: string };
        Returns: string;
      };
      ai_quota: {
        Args: { p_budget_usd: number; p_user_id: string };
        Returns: Json;
      };
      apply_review: {
        Args: { p_good: boolean; p_question_id: number; p_user_id: string };
        Returns: string;
      };
      cleanup_trials: { Args: Record<PropertyKey, never>; Returns: number };
      create_project: {
        Args: {
          p_budget_usd?: number;
          p_content: string;
          p_name: string;
          p_user_id: string;
        };
        Returns: {
          content: string;
          created_at: string;
          error_code: string | null;
          id: string;
          name: string;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_share: {
        Args: { p_session_id: string; p_streak: number; p_user_id: string };
        Returns: string;
      };
      delete_project: {
        Args: { p_project_id: string; p_user_id: string };
        Returns: undefined;
      };
      delete_user_events: { Args: { p_user_id: string }; Returns: undefined };
      pick_push_targets: {
        Args: { p_limit?: number; p_now?: string };
        Returns: {
          review: boolean;
          user_id: string;
        }[];
      };
      purge_old_events: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      record_ai_usage: {
        Args: {
          p_purpose: string;
          p_ref_id: string;
          p_usage: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      record_event: {
        Args: {
          p_anon_id?: string;
          p_name: string;
          p_props?: Json;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      release_ai_usage: { Args: { p_ref_id: string }; Returns: undefined };
      request_push_cron: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      restart_project_generation: {
        Args: {
          p_budget_usd?: number;
          p_project_id: string;
          p_user_id: string;
        };
        Returns: {
          content: string;
          created_at: string;
          error_code: string | null;
          id: string;
          name: string;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_grading: {
        Args: { p_result: Json; p_turn_id: string };
        Returns: Json;
      };
      save_project_questions: {
        Args: { p_error_code: string; p_project_id: string; p_questions: Json };
        Returns: {
          content: string;
          created_at: string;
          error_code: string | null;
          id: string;
          name: string;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      send_feedback: {
        Args: {
          p_body: string;
          p_category?: string;
          p_daily: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      set_bookmark: {
        Args: { p_on: boolean; p_question_id: number; p_user_id: string };
        Returns: undefined;
      };
      set_turn_rating: {
        Args: { p_rating: number; p_turn_id: string; p_user_id: string };
        Returns: undefined;
      };
      start_daily_session: {
        Args: {
          p_budget_usd?: number;
          p_pick: string;
          p_question_id: number;
          p_user_id: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          day: string;
          grade_model: string;
          id: string;
          ip_hash: string | null;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          trial_token: string | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_project_session: {
        Args: {
          p_budget_usd?: number;
          p_question_id: number;
          p_user_id: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          day: string;
          grade_model: string;
          id: string;
          ip_hash: string | null;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          trial_token: string | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_trial: {
        Args: {
          p_budget_usd?: number;
          p_field: string;
          p_ip_hash: string;
          p_trial_token: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          day: string;
          grade_model: string;
          id: string;
          ip_hash: string | null;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          trial_token: string | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_answer: {
        Args: {
          p_answer?: string;
          p_dont_know?: boolean;
          p_trial_token?: string;
          p_turn_id: string;
          p_user_id?: string;
        };
        Returns: {
          answer: string | null;
          answered_at: string | null;
          feedback: Json | null;
          follow_up_prompt: string | null;
          grading_attempts: number;
          grading_started_at: string | null;
          id: string;
          idx: number;
          rating: number | null;
          score: number | null;
          session_id: string;
          status: string;
          verdict: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "turns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      sync_question_id_seq: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
