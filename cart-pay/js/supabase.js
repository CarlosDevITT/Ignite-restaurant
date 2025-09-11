// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Configurações do seu projeto Supabase - você precisará substituir com suas próprias
const supabaseUrl = 'https://qgnqztsxfeugopuhyioq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA'

// Cria e exporta o cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)