export const attachmentExample = {
  filename: 'testing-revocation',
  size: 0,
  ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
}

export const transactionExample = {
  id: 'initiate-cert-transaction-test',
  api_type: 'certificate',
  local_id: 'test-cert-1',
  state: 'submitted',
  transaction_type: 'initiate_cert',
}

export const certExamples = [
  { id: 'test-cert-1', state: 'issued', energy_owner: 'emma-test', regulator: 'ray-test', hydrogen_owner: 'heidi' },
  { id: 'test-cert-4', state: 'initiated', energy_owner: 'emma2-test', regulator: 'ray-test', hydrogen_owner: 'heidi' },
  {
    id: 'test-cert-3',
    state: 'initiated',
    energy_owner: 'member-self-test',
    regulator: 'ray-test',
    latest_token_id: 3,
    hydrogen_owner: 'member-self-test',
    hydrogen_quantity_mwh: 10,
    commitment: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    production_start_time: new Date('2024-01-03T15:17:58.836Z'),
    production_end_time: new Date('2024-01-03T18:17:58.836Z'),
    energy_consumed_mwh: 5,
  },
  {
    id: 'test-cert-2',
    state: 'pending',
    energy_owner: 'member-self-test',
    regulator: 'ray-test',
    hydrogen_owner: 'member-self-test',
    hydrogen_quantity_mwh: 10,
  },
  {
    id: 'test-cert-5',
    state: 'initiated',
    energy_owner: 'emma-test',
    regulator: 'member-self-test',
    hydrogen_owner: 'heidi',
    hydrogen_quantity_mwh: 10,
    commitment: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    production_start_time: new Date('2024-01-03T15:17:58.836Z'),
    production_end_time: new Date('2024-01-03T18:17:58.836Z'),
    energy_consumed_mwh: 5,
  },
]
