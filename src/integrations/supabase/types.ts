export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      approval_log: {
        Row: {
          action: string
          created_at: string
          id: string
          motivo: string | null
          order_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          motivo?: string | null
          order_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          motivo?: string | null
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          preco_anterior: number
          preco_novo: number
          supplier_price_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          preco_anterior: number
          preco_novo: number
          supplier_price_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          preco_anterior?: number
          preco_novo?: number
          supplier_price_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_supplier_price_id_fkey"
            columns: ["supplier_price_id"]
            isOneToOne: false
            referencedRelation: "supplier_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          categoria: string | null
          codigo_interno: string | null
          created_at: string
          descricao: string | null
          id: string
          marca: string | null
          nome: string
          status: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo_interno?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          nome: string
          status?: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo_interno?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          marca?: string | null
          nome?: string
          status?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          unidade: string | null
          unidade_setor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          unidade?: string | null
          unidade_setor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          unidade?: string | null
          unidade_setor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          order_id: string
          preco_unitario: number
          product_id: string
          quantidade: number
          subtotal: number
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          order_id: string
          preco_unitario?: number
          product_id: string
          quantidade: number
          subtotal?: number
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          order_id?: string
          preco_unitario?: number
          product_id?: string
          quantidade?: number
          subtotal?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          emitted_at: string | null
          id: string
          modo: string
          numero: string
          obs_estoquista: string | null
          observacoes: string | null
          previsao_entrega: string | null
          rejected_reason: string | null
          status: string
          total: number
          unidade_setor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          emitted_at?: string | null
          id?: string
          modo?: string
          numero: string
          obs_estoquista?: string | null
          observacoes?: string | null
          previsao_entrega?: string | null
          rejected_reason?: string | null
          status?: string
          total?: number
          unidade_setor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          emitted_at?: string | null
          id?: string
          modo?: string
          numero?: string
          obs_estoquista?: string | null
          observacoes?: string | null
          previsao_entrega?: string | null
          rejected_reason?: string | null
          status?: string
          total?: number
          unidade_setor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          created_at: string
          id: string
          preco_unitario: number
          product_id: string
          quantidade: number
          quotation_id: string
          subtotal: number
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          preco_unitario?: number
          product_id: string
          quantidade?: number
          quotation_id: string
          subtotal?: number
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          preco_unitario?: number
          product_id?: string
          quantidade?: number
          quotation_id?: string
          subtotal?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          estrategia: string
          id: string
          numero: string
          observacoes: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estrategia?: string
          id?: string
          numero: string
          observacoes?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estrategia?: string
          id?: string
          numero?: string
          observacoes?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          order_item_id: string
          quantidade_recebida: number | null
          receipt_id: string
          status: string
          tipo_ocorrencia: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          order_item_id: string
          quantidade_recebida?: number | null
          receipt_id: string
          status?: string
          tipo_ocorrencia?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          order_item_id?: string
          quantidade_recebida?: number | null
          receipt_id?: string
          status?: string
          tipo_ocorrencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          numero: string
          numero_nf: string | null
          observacoes: string | null
          order_id: string
          received_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero: string
          numero_nf?: string | null
          observacoes?: string | null
          order_id: string
          received_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          numero?: string
          numero_nf?: string | null
          observacoes?: string | null
          order_id?: string
          received_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          numero: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          numero: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          numero?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      requisitions: {
        Row: {
          created_at: string
          id: string
          motivo_recusa: string | null
          observacoes: string | null
          order_id: string | null
          product_id: string
          saldo_atual: number
          setor: string | null
          status: string
          unidade: string | null
          unidade_medida: string
          unidade_setor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo_recusa?: string | null
          observacoes?: string | null
          order_id?: string | null
          product_id: string
          saldo_atual?: number
          setor?: string | null
          status?: string
          unidade?: string | null
          unidade_medida?: string
          unidade_setor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo_recusa?: string | null
          observacoes?: string | null
          order_id?: string | null
          product_id?: string
          saldo_atual?: number
          setor?: string | null
          status?: string
          unidade?: string | null
          unidade_medida?: string
          unidade_setor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_prices: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          prazo_entrega: string | null
          preco_unitario: number
          product_id: string
          quantidade_minima: number | null
          supplier_id: string
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          preco_unitario: number
          product_id: string
          quantidade_minima?: number | null
          supplier_id: string
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          prazo_entrega?: string | null
          preco_unitario?: number
          product_id?: string
          quantidade_minima?: number | null
          supplier_id?: string
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cidade: string | null
          cnpj: string | null
          contato_principal: string | null
          created_at: string
          email: string | null
          endereco: string | null
          grupo: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          status: string
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          contato_principal?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          grupo?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          status?: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          contato_principal?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          grupo?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "comprador"
        | "solicitante"
        | "aprovador"
        | "estoquista"
        | "master"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "comprador",
        "solicitante",
        "aprovador",
        "estoquista",
        "master",
      ],
    },
  },
} as const
