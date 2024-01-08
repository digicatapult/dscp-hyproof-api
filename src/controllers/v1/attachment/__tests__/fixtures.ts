import { AttachmentRow } from '../../../../lib/db/types.js'

export const octetExample: AttachmentRow = {
  filename: 'doc.txt',
  size: 1024,
  ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
  id: 'attachment-1-test',
  created_at: new Date('2020-10-10T00:00:00.000Z'),
}

export const jsonExample: AttachmentRow = {
  id: 'attachment-2-test',
  created_at: new Date('2024-01-05T09:39:29.785Z'),
  filename: 'json',
  ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
  size: 26,
}
