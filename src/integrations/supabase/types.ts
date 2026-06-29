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
      inventories: {
        Row: {
          autorizado_em: string | null
          autorizado_por: string | null
          categoria: string | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          id: string
          numero: string | null
          observacoes: string | null
          setor: string | null
          status: string
          titulo: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          setor?: string | null
          status?: string
          titulo: string
          unidade: string
          updated_at?: string
          user_id: string
        }
        Update: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          setor?: string | null
          status?: string
          titulo?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          inventory_id: string
          observacoes: string | null
          product_id: string
          saldo: number
          solicitar_compra: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id: string
          observacoes?: string | null
          product_id: string
          saldo?: number
          solicitar_compra?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string
          observacoes?: string | null
          product_id?: string
          saldo?: number
          solicitar_compra?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_log: {
        Row: {
          action: string
          created_at: string
          detalhes: string | null
          id: string
          inventory_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detalhes?: string | null
          id?: string
          inventory_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          inventory_id?: string
          user_id?: string
        }
        Relationships: []
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
      order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          order_id: string
          size_bytes: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          order_id: string
          size_bytes?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          order_id?: string
          size_bytes?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pcp_compras: {
        Row: {
          categoria: string
          created_at: string
          custo_geral: number | null
          data: string
          fornecedor: string | null
          gelo: number | null
          id: string
          peso_bruto_kg: number | null
          preco_unitario_kg: number | null
          produto: string
          servico_compra: number | null
          servico_filetamento: number | null
          servico_transporte: number | null
          total_pecas: number | null
          unidade_origem: string | null
          updated_at: string
          user_id: string | null
          valor_total_compra: number | null
        }
        Insert: {
          categoria: string
          created_at?: string
          custo_geral?: number | null
          data: string
          fornecedor?: string | null
          gelo?: number | null
          id?: string
          peso_bruto_kg?: number | null
          preco_unitario_kg?: number | null
          produto: string
          servico_compra?: number | null
          servico_filetamento?: number | null
          servico_transporte?: number | null
          total_pecas?: number | null
          unidade_origem?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total_compra?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string
          custo_geral?: number | null
          data?: string
          fornecedor?: string | null
          gelo?: number | null
          id?: string
          peso_bruto_kg?: number | null
          preco_unitario_kg?: number | null
          produto?: string
          servico_compra?: number | null
          servico_filetamento?: number | null
          servico_transporte?: number | null
          total_pecas?: number | null
          unidade_origem?: string | null
          updated_at?: string
          user_id?: string | null
          valor_total_compra?: number | null
        }
        Relationships: []
      }
      pcp_distribuicao: {
        Row: {
          created_at: string
          custo_total: number | null
          custo_unitario_kg: number | null
          data: string
          id: string
          produto: string
          quantidade_kg: number
          unidade_destino: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_total?: number | null
          custo_unitario_kg?: number | null
          data: string
          id?: string
          produto: string
          quantidade_kg: number
          unidade_destino: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_total?: number | null
          custo_unitario_kg?: number | null
          data?: string
          id?: string
          produto?: string
          quantidade_kg?: number
          unidade_destino?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pcp_estoque_cdp: {
        Row: {
          created_at: string
          data: string
          entrada_kg: number | null
          estoque_final_kg: number | null
          estoque_inicial_kg: number | null
          id: string
          inventario_kg: number | null
          produto: string
          saida_kg: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data: string
          entrada_kg?: number | null
          estoque_final_kg?: number | null
          estoque_inicial_kg?: number | null
          id?: string
          inventario_kg?: number | null
          produto: string
          saida_kg?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          entrada_kg?: number | null
          estoque_final_kg?: number | null
          estoque_inicial_kg?: number | null
          id?: string
          inventario_kg?: number | null
          produto?: string
          saida_kg?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pcp_producao: {
        Row: {
          cmv_total: number | null
          cmv_unitario: number | null
          created_at: string
          data: string
          id: string
          observacoes: string | null
          pct_perda: number | null
          produto: string
          quantidade_descartada_kg: number | null
          quantidade_produzida_kg: number | null
          quantidade_vendida_kg: number | null
          unidade: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cmv_total?: number | null
          cmv_unitario?: number | null
          created_at?: string
          data: string
          id?: string
          observacoes?: string | null
          pct_perda?: number | null
          produto: string
          quantidade_descartada_kg?: number | null
          quantidade_produzida_kg?: number | null
          quantidade_vendida_kg?: number | null
          unidade: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cmv_total?: number | null
          cmv_unitario?: number | null
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          pct_perda?: number | null
          produto?: string
          quantidade_descartada_kg?: number | null
          quantidade_produzida_kg?: number | null
          quantidade_vendida_kg?: number | null
          unidade?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pcp_rateio: {
        Row: {
          created_at: string
          custo_chapa: number | null
          custo_file: number | null
          custo_final: number | null
          custo_frita: number | null
          custo_isca: number | null
          data_ref: string
          enviou_rateio: boolean | null
          file_kg: number | null
          id: string
          isca_kg: number | null
          posta_chapa_kg: number | null
          posta_frita_kg: number | null
          produto: string
          total_enviado_kg: number | null
          unidade_devedora: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_chapa?: number | null
          custo_file?: number | null
          custo_final?: number | null
          custo_frita?: number | null
          custo_isca?: number | null
          data_ref: string
          enviou_rateio?: boolean | null
          file_kg?: number | null
          id?: string
          isca_kg?: number | null
          posta_chapa_kg?: number | null
          posta_frita_kg?: number | null
          produto: string
          total_enviado_kg?: number | null
          unidade_devedora: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_chapa?: number | null
          custo_file?: number | null
          custo_final?: number | null
          custo_frita?: number | null
          custo_isca?: number | null
          data_ref?: string
          enviou_rateio?: boolean | null
          file_kg?: number | null
          id?: string
          isca_kg?: number | null
          posta_chapa_kg?: number | null
          posta_frita_kg?: number | null
          produto?: string
          total_enviado_kg?: number | null
          unidade_devedora?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pcp_reembolsos: {
        Row: {
          created_at: string
          custo_final: number | null
          data_ref: string
          data_solicitacao: string | null
          descritivo: string
          enviou_rateio: boolean | null
          id: string
          quantidade: string | null
          unidade_devedora: string
          unidade_origem: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_final?: number | null
          data_ref: string
          data_solicitacao?: string | null
          descritivo: string
          enviou_rateio?: boolean | null
          id?: string
          quantidade?: string | null
          unidade_devedora: string
          unidade_origem: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_final?: number | null
          data_ref?: string
          data_solicitacao?: string | null
          descritivo?: string
          enviou_rateio?: boolean | null
          id?: string
          quantidade?: string | null
          unidade_devedora?: string
          unidade_origem?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pcp_rendimento: {
        Row: {
          casca_apara_kg: number | null
          created_at: string
          data: string
          fornecedor: string | null
          id: string
          liquido_total_kg: number | null
          pcp_compra_id: string | null
          pct_acrescimo_valor: number | null
          pct_casca: number | null
          pct_perda: number | null
          pct_rendimento: number | null
          perda_kg: number | null
          peso_bruto_kg: number | null
          peso_liquido_kg: number | null
          rejeito_final_kg: number | null
          tipo_produto: string | null
          unidade: string | null
          updated_at: string
          user_id: string | null
          valor_final_kg: number | null
          valor_inicial_kg: number | null
        }
        Insert: {
          casca_apara_kg?: number | null
          created_at?: string
          data: string
          fornecedor?: string | null
          id?: string
          liquido_total_kg?: number | null
          pcp_compra_id?: string | null
          pct_acrescimo_valor?: number | null
          pct_casca?: number | null
          pct_perda?: number | null
          pct_rendimento?: number | null
          perda_kg?: number | null
          peso_bruto_kg?: number | null
          peso_liquido_kg?: number | null
          rejeito_final_kg?: number | null
          tipo_produto?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string | null
          valor_final_kg?: number | null
          valor_inicial_kg?: number | null
        }
        Update: {
          casca_apara_kg?: number | null
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          liquido_total_kg?: number | null
          pcp_compra_id?: string | null
          pct_acrescimo_valor?: number | null
          pct_casca?: number | null
          pct_perda?: number | null
          pct_rendimento?: number | null
          perda_kg?: number | null
          peso_bruto_kg?: number | null
          peso_liquido_kg?: number | null
          rejeito_final_kg?: number | null
          tipo_produto?: string | null
          unidade?: string | null
          updated_at?: string
          user_id?: string | null
          valor_final_kg?: number | null
          valor_inicial_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pcp_rendimento_pcp_compra_id_fkey"
            columns: ["pcp_compra_id"]
            isOneToOne: false
            referencedRelation: "pcp_compras"
            referencedColumns: ["id"]
          },
        ]
      }
      pcp_validades: {
        Row: {
          created_at: string
          data_producao: string | null
          data_validade: string
          id: string
          lote: string | null
          produto: string
          quantidade_kg: number | null
          status: string
          unidade: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_producao?: string | null
          data_validade: string
          id?: string
          lote?: string | null
          produto: string
          quantidade_kg?: number | null
          status?: string
          unidade: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_producao?: string | null
          data_validade?: string
          id?: string
          lote?: string | null
          produto?: string
          quantidade_kg?: number | null
          status?: string
          unidade?: string
          updated_at?: string
          user_id?: string | null
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
          permissoes_customizadas: Json | null
          status: string
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
          permissoes_customizadas?: Json | null
          status?: string
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
          permissoes_customizadas?: Json | null
          status?: string
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
          previsao_registrada_por: string | null
          rejected_reason: string | null
          status: string
          titulo: string | null
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
          previsao_registrada_por?: string | null
          rejected_reason?: string | null
          status?: string
          titulo?: string | null
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
          previsao_registrada_por?: string | null
          rejected_reason?: string | null
          status?: string
          titulo?: string | null
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
      requisition_items: {
        Row: {
          created_at: string
          destino: string | null
          id: string
          observacoes: string | null
          pedido: number
          product_id: string
          requisition_id: string
          saldo: number
          triagem_em: string | null
          triagem_por: string | null
        }
        Insert: {
          created_at?: string
          destino?: string | null
          id?: string
          observacoes?: string | null
          pedido?: number
          product_id: string
          requisition_id: string
          saldo?: number
          triagem_em?: string | null
          triagem_por?: string | null
        }
        Update: {
          created_at?: string
          destino?: string | null
          id?: string
          observacoes?: string | null
          pedido?: number
          product_id?: string
          requisition_id?: string
          saldo?: number
          triagem_em?: string | null
          triagem_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
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
          titulo: string | null
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
          titulo?: string | null
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
          titulo?: string | null
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
          estado: string | null
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
          estado?: string | null
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
          estado?: string | null
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
      cleanup_purchase_order_duplicate_items: {
        Args: { _order_id: string }
        Returns: number
      }
      generate_inventory_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      get_email_by_name: { Args: { _name: string }; Returns: string }
      get_profile_names: {
        Args: { _user_ids: string[] }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_profile_sensitive: {
        Args: { _user_id: string }
        Returns: {
          email: string
          permissoes_customizadas: Json
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_profiles_for_master: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          permissoes_customizadas: Json
          status: string
          unidade: string
          unidade_setor: string
          updated_at: string
          user_id: string
        }[]
      }
      notify_masters_new_signup: {
        Args: { _mensagem: string; _titulo: string }
        Returns: undefined
      }
      notify_users: {
        Args: {
          _mensagem: string
          _target_role: Database["public"]["Enums"]["app_role"]
          _tipo?: string
          _titulo: string
        }
        Returns: undefined
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
        | "financeiro"
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
        "financeiro",
      ],
    },
  },
} as const
