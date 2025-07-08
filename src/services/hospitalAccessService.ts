// ============================================================================
// SERVIÇO DE ACESSO A HOSPITAIS - SIGTAP BILLING WIZARD
// Sistema: SIGTAP Billing Wizard v3.0
// Arquivo: src/services/hospitalAccessService.ts
// ============================================================================

import { supabase } from '../lib/supabase';
import { HospitalUtils, HOSPITALS, USER_ROLES, type Hospital } from '../config/hospitalMapping';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  full_name: string;
  hospital_access: string[];
  permissions: string[];
  is_admin: boolean;
  has_full_access: boolean;
}

export interface HospitalAccess {
  hospital_id: string;
  hospital_name: string;
  hospital_code: string;
}

export class HospitalAccessService {
  /**
   * Obtém informações completas do usuário atual
   */
  static async getCurrentUserInfo(): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_current_user_info');

      if (error) {
        console.error('Erro ao obter informações do usuário:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Erro na função getCurrentUserInfo:', error);
      return null;
    }
  }

  /**
   * Obtém lista de hospitais acessíveis pelo usuário atual
   */
  static async getUserAccessibleHospitals(): Promise<HospitalAccess[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_accessible_hospitals');

      if (error) {
        console.error('Erro ao obter hospitais acessíveis:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro na função getUserAccessibleHospitals:', error);
      return [];
    }
  }

  /**
   * Verifica se o usuário tem acesso a um hospital específico
   */
  static async checkHospitalAccess(hospitalId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_hospital_access', { target_hospital_id: hospitalId });

      if (error) {
        console.error('Erro ao verificar acesso ao hospital:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Erro na função checkHospitalAccess:', error);
      return false;
    }
  }

  /**
   * Obtém informações detalhadas dos hospitais acessíveis
   */
  static async getDetailedAccessibleHospitals(): Promise<Hospital[]> {
    try {
      const accessibleHospitals = await this.getUserAccessibleHospitals();
      
      return accessibleHospitals
        .map(ah => HospitalUtils.getById(ah.hospital_id))
        .filter((hospital): hospital is Hospital => hospital !== undefined);
    } catch (error) {
      console.error('Erro ao obter hospitais detalhados:', error);
      return [];
    }
  }

  /**
   * Filtra dados por hospitais acessíveis (função utilitária para o frontend)
   */
  static filterDataByAccessibleHospitals<T extends { hospital_id?: string }>(
    data: T[], 
    userProfile: UserProfile
  ): T[] {
    // Usuários com acesso total veem todos os dados
    if (userProfile.has_full_access) {
      return data;
    }

    // Usuários básicos veem apenas dados dos seus hospitais
    return data.filter(item => 
      item.hospital_id && 
      HospitalUtils.hasHospitalAccess(
        userProfile.role, 
        userProfile.hospital_access, 
        item.hospital_id
      )
    );
  }

  /**
   * Obtém ID do hospital baseado no email do usuário
   */
  static getHospitalIdByEmail(email: string): string | null {
    const hospital = HospitalUtils.getByUserEmail(email);
    return hospital?.id || null;
  }

  /**
   * Verifica se um usuário é administrador
   */
  static isAdmin(userProfile: UserProfile): boolean {
    return userProfile.is_admin || userProfile.role === 'admin' || userProfile.role === 'developer';
  }

  /**
   * Verifica se um usuário tem acesso total ao sistema
   */
  static hasFullAccess(userProfile: UserProfile): boolean {
    return userProfile.has_full_access || USER_ROLES[userProfile.role]?.hasFullAccess === true;
  }

  /**
   * Obtém lista de opções de hospital para SELECT/combobox
   */
  static async getHospitalOptions(): Promise<Array<{value: string, label: string}>> {
    try {
      const accessibleHospitals = await this.getUserAccessibleHospitals();
      
      return accessibleHospitals.map(hospital => ({
        value: hospital.hospital_id,
        label: `${hospital.hospital_code} - ${hospital.hospital_name}`
      }));
    } catch (error) {
      console.error('Erro ao obter opções de hospital:', error);
      return [];
    }
  }

  /**
   * Valida se dados pertencem a hospitais acessíveis antes de operações
   */
  static async validateHospitalAccess(hospitalId: string): Promise<{
    hasAccess: boolean;
    hospitalInfo?: Hospital;
    error?: string;
  }> {
    try {
      const hasAccess = await this.checkHospitalAccess(hospitalId);
      
      if (!hasAccess) {
        return {
          hasAccess: false,
          error: 'Acesso negado a este hospital'
        };
      }

      const hospitalInfo = HospitalUtils.getById(hospitalId);
      
      return {
        hasAccess: true,
        hospitalInfo
      };
    } catch (error) {
      return {
        hasAccess: false,
        error: 'Erro ao validar acesso ao hospital'
      };
    }
  }

  /**
   * Obtém estatísticas de acesso do usuário
   */
  static async getUserAccessStats(): Promise<{
    totalHospitals: number;
    accessibleHospitals: number;
    hasFullAccess: boolean;
    role: string;
  }> {
    try {
      const userInfo = await this.getCurrentUserInfo();
      const accessibleHospitals = await this.getUserAccessibleHospitals();

      return {
        totalHospitals: Object.keys(HOSPITALS).length,
        accessibleHospitals: accessibleHospitals.length,
        hasFullAccess: userInfo?.has_full_access || false,
        role: userInfo?.role || 'unknown'
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de acesso:', error);
      return {
        totalHospitals: 0,
        accessibleHospitals: 0,
        hasFullAccess: false,
        role: 'unknown'
      };
    }
  }

  /**
   * Cache para otimização (simples implementação)
   */
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  static getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  static setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

export default HospitalAccessService; 