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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          comment: string | null
          content_type: string | null
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number | null
          folder: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          content_type?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          folder?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          content_type?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          folder?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          bdi: number | null
          budget_id: string
          category: string | null
          created_at: string
          description: string
          id: string
          quantity: number | null
          sort_order: number | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          bdi?: number | null
          budget_id: string
          category?: string | null
          created_at?: string
          description: string
          id?: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          bdi?: number | null
          budget_id?: string
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_measurement_items: {
        Row: {
          budget_item_id: string
          created_at: string
          id: string
          measured_at: string | null
          measured_percentage: number | null
          measured_quantity: number | null
          measurement_id: string
          notes: string | null
        }
        Insert: {
          budget_item_id: string
          created_at?: string
          id?: string
          measured_at?: string | null
          measured_percentage?: number | null
          measured_quantity?: number | null
          measurement_id: string
          notes?: string | null
        }
        Update: {
          budget_item_id?: string
          created_at?: string
          id?: string
          measured_at?: string | null
          measured_percentage?: number | null
          measured_quantity?: number | null
          measurement_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_measurement_items_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_measurement_items_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "budget_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_measurements: {
        Row: {
          budget_id: string
          closed_at: string | null
          created_at: string
          id: string
          measurement_number: number
          notes: string | null
          reference_period: string | null
          status: string
          user_id: string
        }
        Insert: {
          budget_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          measurement_number?: number
          notes?: string | null
          reference_period?: string | null
          status?: string
          user_id: string
        }
        Update: {
          budget_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          measurement_number?: number
          notes?: string | null
          reference_period?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_measurements_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plan_items: {
        Row: {
          budget_item_id: string
          created_at: string
          id: string
          plan_period_id: string
          planned_percentage: number | null
        }
        Insert: {
          budget_item_id: string
          created_at?: string
          id?: string
          plan_period_id: string
          planned_percentage?: number | null
        }
        Update: {
          budget_item_id?: string
          created_at?: string
          id?: string
          plan_period_id?: string
          planned_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_plan_items_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_plan_items_plan_period_id_fkey"
            columns: ["plan_period_id"]
            isOneToOne: false
            referencedRelation: "budget_plan_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plan_periods: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          period_date: string
          period_label: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          period_date: string
          period_label?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          period_date?: string
          period_label?: string | null
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_plan_periods_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_code: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          obra_id: string
          status: string
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          obra_id: string
          status?: string
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_code?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          obra_id?: string
          status?: string
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          cellphone: string | null
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          cellphone?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          cellphone?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          category: string
          client_id: string
          created_at: string
          id: string
          message: string
          obra_id: string | null
          user_id: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          id?: string
          message: string
          obra_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          obra_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_permissions: {
        Row: {
          client_id: string
          created_at: string
          enabled: boolean
          id: string
          module: string
          platform: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          platform?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_permissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          address_number: string | null
          birth_date: string | null
          category: string | null
          cellphone: string | null
          cep: string | null
          city: string | null
          company_id: string | null
          complement: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          marital_status: string | null
          name: string
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          person_type: string | null
          phone: string | null
          profession: string | null
          rg: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          category?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          marital_status?: string | null
          name: string
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          category?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          marital_status?: string | null
          name?: string
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          address: string | null
          address_number: string | null
          cellphone: string | null
          cep: string | null
          city: string | null
          company_type: string
          complement: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          ie: string | null
          logo_url: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          parent_id: string | null
          phone: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_type?: string
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          parent_id?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_type?: string
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          parent_id?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_docs: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          obra_id: string | null
          payment_date: string | null
          status: string
          supplier_id: string | null
          type: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          obra_id?: string | null
          payment_date?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          obra_id?: string | null
          payment_date?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_docs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_docs_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_docs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          active: boolean
          created_at: string
          holiday_date: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          holiday_date: string
          id?: string
          name: string
          type?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          unit: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          unit?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          unit?: string
          user_id?: string | null
        }
        Relationships: []
      }
      letterhead_configs: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          image_align_h: string | null
          image_align_v: string | null
          image_fill: boolean | null
          image_mode: string | null
          image_opacity: number | null
          image_url: string | null
          text_bold: boolean | null
          text_color: string | null
          text_direction: string | null
          text_italic: boolean | null
          text_message: string | null
          text_opacity: number | null
          text_size: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          image_align_h?: string | null
          image_align_v?: string | null
          image_fill?: boolean | null
          image_mode?: string | null
          image_opacity?: number | null
          image_url?: string | null
          text_bold?: boolean | null
          text_color?: string | null
          text_direction?: string | null
          text_italic?: boolean | null
          text_message?: string | null
          text_opacity?: number | null
          text_size?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          image_align_h?: string | null
          image_align_v?: string | null
          image_fill?: boolean | null
          image_mode?: string | null
          image_opacity?: number | null
          image_url?: string | null
          text_bold?: boolean | null
          text_color?: string | null
          text_direction?: string | null
          text_italic?: boolean | null
          text_message?: string | null
          text_opacity?: number | null
          text_size?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letterhead_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      obra_admin_rates: {
        Row: {
          cost_type: string
          created_at: string
          fixed_value: number | null
          id: string
          obra_id: string
          percentage: number | null
          user_id: string
        }
        Insert: {
          cost_type: string
          created_at?: string
          fixed_value?: number | null
          id?: string
          obra_id: string
          percentage?: number | null
          user_id: string
        }
        Update: {
          cost_type?: string
          created_at?: string
          fixed_value?: number | null
          id?: string
          obra_id?: string
          percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_admin_rates_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_contacts: {
        Row: {
          cellphone: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          obra_id: string
          origin: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          cellphone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          obra_id: string
          origin?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          cellphone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          obra_id?: string
          origin?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_contacts_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_daily_entries: {
        Row: {
          category: string | null
          created_at: string
          entry_date: string
          id: string
          message: string
          obra_id: string
          phase: string | null
          service: string | null
          show_to_client: boolean
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          message: string
          obra_id: string
          phase?: string | null
          service?: string | null
          show_to_client?: boolean
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          message?: string
          obra_id?: string
          phase?: string | null
          service?: string | null
          show_to_client?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_daily_entries_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          active: boolean
          actual_end_date: string | null
          address: string | null
          address_number: string | null
          area_m2: number | null
          art_number: string | null
          billing_address: string | null
          billing_address_source: string | null
          billing_cep: string | null
          billing_city: string | null
          billing_complement: string | null
          billing_frequency: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          billing_type: string | null
          category: string | null
          cep: string | null
          city: string | null
          client_access: boolean | null
          client_id: string | null
          cno: string | null
          company_id: string | null
          complement: string | null
          created_at: string
          description: string | null
          document_type: string | null
          duration: number | null
          duration_unit: string | null
          empreiteiro: string | null
          expected_end_date: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          planning_frequency: string | null
          rdo_sections: string[] | null
          resp_obra: string | null
          resp_tecnico: string | null
          start_date: string | null
          state: string | null
          status: string
          stock_control: boolean | null
          stock_type: string | null
          total_budget: number | null
          tracking_method: string | null
          updated_at: string
          user_id: string
          work_days: string[] | null
        }
        Insert: {
          active?: boolean
          actual_end_date?: string | null
          address?: string | null
          address_number?: string | null
          area_m2?: number | null
          art_number?: string | null
          billing_address?: string | null
          billing_address_source?: string | null
          billing_cep?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_frequency?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_type?: string | null
          category?: string | null
          cep?: string | null
          city?: string | null
          client_access?: boolean | null
          client_id?: string | null
          cno?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          duration?: number | null
          duration_unit?: string | null
          empreiteiro?: string | null
          expected_end_date?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          planning_frequency?: string | null
          rdo_sections?: string[] | null
          resp_obra?: string | null
          resp_tecnico?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          stock_control?: boolean | null
          stock_type?: string | null
          total_budget?: number | null
          tracking_method?: string | null
          updated_at?: string
          user_id: string
          work_days?: string[] | null
        }
        Update: {
          active?: boolean
          actual_end_date?: string | null
          address?: string | null
          address_number?: string | null
          area_m2?: number | null
          art_number?: string | null
          billing_address?: string | null
          billing_address_source?: string | null
          billing_cep?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_frequency?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_type?: string | null
          category?: string | null
          cep?: string | null
          city?: string | null
          client_access?: boolean | null
          client_id?: string | null
          cno?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          duration?: number | null
          duration_unit?: string | null
          empreiteiro?: string | null
          expected_end_date?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          planning_frequency?: string | null
          rdo_sections?: string[] | null
          resp_obra?: string | null
          resp_tecnico?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          stock_control?: boolean | null
          stock_type?: string | null
          total_budget?: number | null
          tracking_method?: string | null
          updated_at?: string
          user_id?: string
          work_days?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          brand: string | null
          complement: string | null
          created_at: string
          description: string
          discount_percent: number | null
          discount_value: number | null
          freight: number | null
          id: string
          insumo_id: string | null
          item_type: string
          obra_id: string | null
          phase: string | null
          purchase_order_id: string
          quantity: number
          service: string | null
          sort_order: number | null
          total: number | null
          unit: string
          unit_price: number
        }
        Insert: {
          brand?: string | null
          complement?: string | null
          created_at?: string
          description: string
          discount_percent?: number | null
          discount_value?: number | null
          freight?: number | null
          id?: string
          insumo_id?: string | null
          item_type?: string
          obra_id?: string | null
          phase?: string | null
          purchase_order_id: string
          quantity?: number
          service?: string | null
          sort_order?: number | null
          total?: number | null
          unit?: string
          unit_price?: number
        }
        Update: {
          brand?: string | null
          complement?: string | null
          created_at?: string
          description?: string
          discount_percent?: number | null
          discount_value?: number | null
          freight?: number | null
          id?: string
          insumo_id?: string | null
          item_type?: string
          obra_id?: string | null
          phase?: string | null
          purchase_order_id?: string
          quantity?: number
          service?: string | null
          sort_order?: number | null
          total?: number | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_receivings: {
        Row: {
          created_at: string
          delivery_date: string | null
          id: string
          notes: string | null
          purchase_order_id: string
          purchase_order_item_id: string
          quantity: number
          received_at: string
          romaneio: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          purchase_order_id: string
          purchase_order_item_id: string
          quantity?: number
          received_at?: string
          romaneio?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string
          purchase_order_item_id?: string
          quantity?: number
          received_at?: string
          romaneio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receivings_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receivings_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          billing_address: string | null
          billing_address_source: string | null
          billing_cep: string | null
          billing_city: string | null
          billing_complement: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          company_id: string | null
          created_at: string
          delivery_address: string | null
          delivery_address_source: string | null
          delivery_cep: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_date: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_receiver: string | null
          delivery_state: string | null
          description: string | null
          discount_percent: number | null
          discount_value: number | null
          freight: number | null
          id: string
          notes: string | null
          obra_id: string | null
          order_code: string | null
          order_date: string | null
          payment_terms: string | null
          status: string | null
          subtotal: number | null
          supplier_id: string
          total_value: number | null
          user_id: string
          vendor_contact_id: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_address_source?: string | null
          billing_cep?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          company_id?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_address_source?: string | null
          delivery_cep?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_date?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_receiver?: string | null
          delivery_state?: string | null
          description?: string | null
          discount_percent?: number | null
          discount_value?: number | null
          freight?: number | null
          id?: string
          notes?: string | null
          obra_id?: string | null
          order_code?: string | null
          order_date?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id: string
          total_value?: number | null
          user_id: string
          vendor_contact_id?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_address_source?: string | null
          billing_cep?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          company_id?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_address_source?: string | null
          delivery_cep?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_date?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_receiver?: string | null
          delivery_state?: string | null
          description?: string | null
          discount_percent?: number | null
          discount_value?: number | null
          freight?: number | null
          id?: string
          notes?: string | null
          obra_id?: string | null
          order_code?: string | null
          order_date?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string
          total_value?: number | null
          user_id?: string
          vendor_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_contact_id_fkey"
            columns: ["vendor_contact_id"]
            isOneToOne: false
            referencedRelation: "supplier_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_quotations: {
        Row: {
          company_id: string | null
          created_at: string
          deadline: string | null
          delivery_address: string | null
          delivery_address_source: string | null
          delivery_cep: string | null
          delivery_city: string | null
          delivery_complement: string | null
          delivery_neighborhood: string | null
          delivery_number: string | null
          delivery_state: string | null
          description: string | null
          id: string
          needed_by: string | null
          notes: string | null
          obra_id: string | null
          response_deadline: string | null
          sending_notes: string | null
          status: string | null
          supplier_id: string | null
          title: string
          total_value: number | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          delivery_address?: string | null
          delivery_address_source?: string | null
          delivery_cep?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_state?: string | null
          description?: string | null
          id?: string
          needed_by?: string | null
          notes?: string | null
          obra_id?: string | null
          response_deadline?: string | null
          sending_notes?: string | null
          status?: string | null
          supplier_id?: string | null
          title: string
          total_value?: number | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          delivery_address?: string | null
          delivery_address_source?: string | null
          delivery_cep?: string | null
          delivery_city?: string | null
          delivery_complement?: string | null
          delivery_neighborhood?: string | null
          delivery_number?: string | null
          delivery_state?: string | null
          description?: string | null
          id?: string
          needed_by?: string | null
          notes?: string | null
          obra_id?: string | null
          response_deadline?: string | null
          sending_notes?: string | null
          status?: string | null
          supplier_id?: string | null
          title?: string
          total_value?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_quotations_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          complement: string | null
          created_at: string
          id: string
          item: string
          item_type: string
          phase: string | null
          quantity: number
          request_id: string
          service: string | null
          unit: string
          unit_price: number | null
        }
        Insert: {
          complement?: string | null
          created_at?: string
          id?: string
          item: string
          item_type?: string
          phase?: string | null
          quantity?: number
          request_id: string
          service?: string | null
          unit?: string
          unit_price?: number | null
        }
        Update: {
          complement?: string | null
          created_at?: string
          id?: string
          item?: string
          item_type?: string
          phase?: string | null
          quantity?: number
          request_id?: string
          service?: string | null
          unit?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          needed_by: string | null
          notes: string | null
          obra_id: string | null
          priority: string | null
          quantity: number | null
          status: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          obra_id?: string | null
          priority?: string | null
          quantity?: number | null
          status?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          obra_id?: string | null
          priority?: string | null
          quantity?: number | null
          status?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          brand: string | null
          complement: string | null
          created_at: string
          description: string
          id: string
          insumo_id: string | null
          item_type: string
          phase: string | null
          quantity: number
          quotation_id: string
          service: string | null
          unit: string
          unit_price: number | null
        }
        Insert: {
          brand?: string | null
          complement?: string | null
          created_at?: string
          description: string
          id?: string
          insumo_id?: string | null
          item_type?: string
          phase?: string | null
          quantity?: number
          quotation_id: string
          service?: string | null
          unit?: string
          unit_price?: number | null
        }
        Update: {
          brand?: string | null
          complement?: string | null
          created_at?: string
          description?: string
          id?: string
          insumo_id?: string | null
          item_type?: string
          phase?: string | null
          quantity?: number
          quotation_id?: string
          service?: string | null
          unit?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_links: {
        Row: {
          created_at: string
          id: string
          linked_entity_id: string
          linked_entity_type: string
          notes: string | null
          quotation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_entity_id: string
          linked_entity_type: string
          notes?: string | null
          quotation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_entity_id?: string
          linked_entity_type?: string
          notes?: string | null
          quotation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_links_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_messages: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          quotation_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message: string
          quotation_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          quotation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_messages_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_responses: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quotation_id: string
          selected: boolean
          supplier_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quotation_id: string
          selected?: boolean
          supplier_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quotation_id?: string
          selected?: boolean
          supplier_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_responses_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_responses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_suppliers: {
        Row: {
          created_at: string
          id: string
          quotation_id: string
          response_at: string | null
          response_notes: string | null
          response_value: number | null
          selected: boolean | null
          sent_at: string | null
          sent_method: string | null
          status: string | null
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quotation_id: string
          response_at?: string | null
          response_notes?: string | null
          response_value?: number | null
          selected?: boolean | null
          sent_at?: string | null
          sent_method?: string | null
          status?: string | null
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quotation_id?: string
          response_at?: string | null
          response_notes?: string | null
          response_value?: number | null
          selected?: boolean | null
          sent_at?: string | null
          sent_method?: string | null
          status?: string | null
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_suppliers_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_suppliers_supplier_id_fkey"
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
          deadline: string | null
          description: string | null
          id: string
          obra_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          obra_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          obra_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bank_accounts: {
        Row: {
          account: string | null
          account_type: string | null
          agency: string | null
          bank_name: string | null
          created_at: string
          holder_document: string | null
          holder_name: string | null
          id: string
          notes: string | null
          pix_key: string | null
          pix_type: string | null
          supplier_id: string
          user_id: string
        }
        Insert: {
          account?: string | null
          account_type?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          pix_type?: string | null
          supplier_id: string
          user_id: string
        }
        Update: {
          account?: string | null
          account_type?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          pix_type?: string | null
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          category: string
          created_at: string
          id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_certifications: {
        Row: {
          certificate_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          name: string
          notes: string | null
          status: string | null
          supplier_id: string
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name: string
          notes?: string | null
          status?: string | null
          supplier_id: string
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name?: string
          notes?: string | null
          status?: string | null
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_certifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          cellphone: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          supplier_id: string
          user_id: string
        }
        Insert: {
          cellphone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          supplier_id: string
          user_id: string
        }
        Update: {
          cellphone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchases: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_number: string | null
          notes: string | null
          obra_id: string | null
          payment_status: string | null
          purchase_date: string | null
          quantity: number | null
          supplier_id: string
          total_price: number | null
          unit: string | null
          unit_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          obra_id?: string | null
          payment_status?: string | null
          purchase_date?: string | null
          quantity?: number | null
          supplier_id: string
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          obra_id?: string | null
          payment_status?: string | null
          purchase_date?: string | null
          quantity?: number | null
          supplier_id?: string
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quality_ratings: {
        Row: {
          created_at: string
          criterion: string
          evaluation_date: string | null
          id: string
          notes: string | null
          rating: number
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criterion: string
          evaluation_date?: string | null
          id?: string
          notes?: string | null
          rating?: number
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          criterion?: string
          evaluation_date?: string | null
          id?: string
          notes?: string | null
          rating?: number
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quality_ratings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          address_number: string | null
          category: string | null
          cellphone: string | null
          cep: string | null
          city: string | null
          company_id: string | null
          complement: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          ie: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          person_type: string | null
          phone: string | null
          recommended: boolean | null
          site: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          category?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          recommended?: boolean | null
          site?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          category?: string | null
          cellphone?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          recommended?: boolean | null
          site?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_doc_installments: {
        Row: {
          created_at: string
          document_id: string
          due_date: string | null
          id: string
          installment_number: number
          notes: string | null
          payment_date: string | null
          proof_file_name: string | null
          proof_path: string | null
          status: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          document_id: string
          due_date?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          payment_date?: string | null
          proof_file_name?: string | null
          proof_path?: string | null
          status?: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          document_id?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          payment_date?: string | null
          proof_file_name?: string | null
          proof_path?: string | null
          status?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_doc_installments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vehicle_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          created_at: string
          description: string
          doc_type: string
          due_date: string | null
          id: string
          installment_count: number | null
          insurer: string | null
          notes: string | null
          payment_date: string | null
          payment_mode: string | null
          policy_number: string | null
          reference_year: number | null
          status: string
          user_id: string
          value: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description: string
          doc_type?: string
          due_date?: string | null
          id?: string
          installment_count?: number | null
          insurer?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          policy_number?: string | null
          reference_year?: number | null
          status?: string
          user_id: string
          value?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string
          doc_type?: string
          due_date?: string | null
          id?: string
          installment_count?: number | null
          insurer?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          policy_number?: string | null
          reference_year?: number | null
          status?: string
          user_id?: string
          value?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_fueling: {
        Row: {
          created_at: string
          fuel_type: string | null
          fueling_date: string | null
          id: string
          km_at_fueling: number | null
          liters: number | null
          notes: string | null
          price_per_liter: number | null
          station: string | null
          total_value: number | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          fuel_type?: string | null
          fueling_date?: string | null
          id?: string
          km_at_fueling?: number | null
          liters?: number | null
          notes?: string | null
          price_per_liter?: number | null
          station?: string | null
          total_value?: number | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          fuel_type?: string | null
          fueling_date?: string | null
          id?: string
          km_at_fueling?: number | null
          liters?: number | null
          notes?: string | null
          price_per_liter?: number | null
          station?: string | null
          total_value?: number | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fueling_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_insurance: {
        Row: {
          broker: string | null
          coverage_type: string | null
          created_at: string
          deductible_value: number | null
          end_date: string | null
          id: string
          installment_count: number | null
          insured_name: string | null
          insurer: string
          notes: string | null
          payment_method: string | null
          policy_file_name: string | null
          policy_number: string | null
          policy_path: string | null
          premium_value: number | null
          start_date: string | null
          status: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          broker?: string | null
          coverage_type?: string | null
          created_at?: string
          deductible_value?: number | null
          end_date?: string | null
          id?: string
          installment_count?: number | null
          insured_name?: string | null
          insurer: string
          notes?: string | null
          payment_method?: string | null
          policy_file_name?: string | null
          policy_number?: string | null
          policy_path?: string | null
          premium_value?: number | null
          start_date?: string | null
          status?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          broker?: string | null
          coverage_type?: string | null
          created_at?: string
          deductible_value?: number | null
          end_date?: string | null
          id?: string
          installment_count?: number | null
          insured_name?: string | null
          insurer?: string
          notes?: string | null
          payment_method?: string | null
          policy_file_name?: string | null
          policy_number?: string | null
          policy_path?: string | null
          premium_value?: number | null
          start_date?: string | null
          status?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insurance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenances: {
        Row: {
          created_at: string
          description: string
          id: string
          km_at_maintenance: number | null
          maintenance_date: string | null
          maintenance_type: string
          next_date: string | null
          next_km: number | null
          notes: string | null
          supplier_id: string | null
          user_id: string
          value: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          km_at_maintenance?: number | null
          maintenance_date?: string | null
          maintenance_type?: string
          next_date?: string | null
          next_km?: number | null
          notes?: string | null
          supplier_id?: string | null
          user_id: string
          value?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          km_at_maintenance?: number | null
          maintenance_date?: string | null
          maintenance_type?: string
          next_date?: string | null
          next_km?: number | null
          notes?: string | null
          supplier_id?: string | null
          user_id?: string
          value?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenances_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acquisition_date: string | null
          acquisition_value: number | null
          active: boolean
          brand: string | null
          category: string | null
          chassis: string | null
          color: string | null
          company_id: string | null
          created_at: string
          depreciation_rate: number | null
          fuel_type: string | null
          id: string
          km_current: number | null
          market_value: number | null
          model: string | null
          notes: string | null
          owner_document: string | null
          owner_name: string | null
          plate: string
          renavam: string | null
          status: string
          updated_at: string
          user_id: string
          year_manufacture: number | null
          year_model: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          active?: boolean
          brand?: string | null
          category?: string | null
          chassis?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          depreciation_rate?: number | null
          fuel_type?: string | null
          id?: string
          km_current?: number | null
          market_value?: number | null
          model?: string | null
          notes?: string | null
          owner_document?: string | null
          owner_name?: string | null
          plate: string
          renavam?: string | null
          status?: string
          updated_at?: string
          user_id: string
          year_manufacture?: number | null
          year_model?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          active?: boolean
          brand?: string | null
          category?: string | null
          chassis?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          depreciation_rate?: number | null
          fuel_type?: string | null
          id?: string
          km_current?: number | null
          market_value?: number | null
          model?: string | null
          notes?: string | null
          owner_document?: string | null
          owner_name?: string | null
          plate?: string
          renavam?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          year_manufacture?: number | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
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
      app_role: ["admin", "manager", "user"],
    },
  },
} as const
