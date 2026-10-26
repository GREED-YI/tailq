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
          theme?: string;
          topics?: string[];
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
          level: string;
          prompt: string;
          topic_id: string;
          trial_field: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: number;
          is_hidden?: boolean;
          level: string;
          prompt: string;
          topic_id: string;
          trial_field?: string | null;
        };
        Update: {
          id?: number;
          is_hidden?: boolean;
          level?: string;
          prompt?: string;
          topic_id?: string;
          trial_field?: string | null;
        };
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
          id: string;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          day: string;
          id?: string;
          kind: string;
          pick?: string | null;
          question_id: number;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          day?: string;
          id?: string;
          kind?: string;
          pick?: string | null;
          question_id?: number;
          status?: string;
          user_id?: string;
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
          level: string;
          prompt: string;
          topic_id: string;
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
    };
    Functions: {
      start_daily_session: {
        Args: { p_pick: string; p_question_id: number; p_user_id: string };
        Returns: {
          completed_at: string | null;
          created_at: string;
          day: string;
          id: string;
          kind: string;
          pick: string | null;
          question_id: number;
          status: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "sessions";
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
