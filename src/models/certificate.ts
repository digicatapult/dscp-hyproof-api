import { UUID } from './strings.js'

export type GetCertificateResponse = {
  id: UUID
  state: 'pending' | 'initiated' | 'issued' | 'revoked'
  hydrogen_owner: string
  energy_owner: string
  regulator: string
  hydrogen_quantity_mwh: number
  embodied_co2?: number | null
  original_token_id?: number | null
  latest_token_id?: number | null
  created_at: Date
  updated_at: Date
  commitment: string
  commitment_salt?: string | null
  production_start_time?: Date | null
  production_end_time?: Date | null
  energy_consumed_mwh?: number | null
  revocation_reason?: UUID | null
}
export type ListCertificatesResponse = GetCertificateResponse[]

/**
 * Certificate Request Body example
 * @example {
 * "energy_consumed_mwh": 10,
 * "production_end_time": "2023-12-11T20:34:21.749Z",
 * "production_start_time": "2023-12-10T18:34:21.749Z",
 * "regulator": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
 * "energy_owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
 * "hydrogen_quantity_mwh": 5
 * }
 * {
  "energy_consumed_mwh": 10,
  "production_end_time": "2023-12-10T20:46:35.892Z",
  "production_start_time": "2023-12-10T18:46:35.892Z",
  "regulator": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
  "energy_owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "hydrogen_quantity_mwh": 5
}
 */
export type InitiatePayload = {
  hydrogen_quantity_mwh: number
  energy_owner: string
  regulator: string
  production_start_time: Date
  production_end_time: Date
  energy_consumed_mwh: number
}

export type UpdatePayload = {
  production_start_time: Date
  production_end_time: Date
  energy_consumed_mwh: number
  commitment_salt: string
}

export type RevokePayload = {
  reason: UUID
}
/**
 * 15193219-3340-4083-9ee9-a2cd37c14e7e
 * af87b3d4-94f5-4b53-8d71-e8ec95a96a17
 */

export type IssuancePayload = {
  embodied_co2?: number
}
