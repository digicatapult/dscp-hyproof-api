import { expect } from 'chai'
import sinon from 'sinon'
import mockdate from 'mockdate'

import { attachment } from '../index.js'
import { Env } from '../../../../env.js'
import Database from '../../../../lib/db/index.js'
import { octetExample, jsonExample } from './fixtures.js'
import Ipfs from '../../../../lib/ipfs.js'
import { BadRequest, InternalServerError, NotFound } from '../../../../lib/error-handler/index.js'
import { AttachmentRow } from '../../../../lib/db/types.js'

mockdate.set('2020-10-10')

describe('v1/attachment', () => {
  let response: any
  let controller: attachment
  const database: Database = new Database()
  const ipfs: Ipfs = new Ipfs(new Env())

  const stubs = {
    getFile: sinon
      .stub(ipfs, 'getFile' as any)
      .callsFake(async () => ({ blob: { arrayBuffer: () => '0'.repeat(1024) }, filename: 'a' })),
    addFile: sinon.stub(ipfs, 'addFile' as any).callsFake(async () => 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn'),
    get: sinon.stub(database, 'get').callsFake(async () => [octetExample]),
    update: sinon.stub(database, 'update' as any).callsFake(async (_, updates: any) => [
      {
        ...octetExample,
        ...updates,
      },
    ]),
    insert: sinon
      .stub(database, 'insert' as any)
      .callsFake((_, data: any) => [{ ...data, created_at: new Date(), id: 'attachment-insert-test' }]),
  }

  before(() => {
    controller = new attachment(database, ipfs)
  })

  after(() => {
    stubs.get.reset()
    stubs.getFile.reset()
    stubs.insert.reset()
    stubs.get.reset()
    stubs.update.reset()
  })

  describe('create() - POST /', () => {
    describe('if payload does not contain body or file', () => {
      beforeEach(async () => {
        response = await controller.create({} as any).catch((err) => err)
      })

      it('throws BadRequest error', () => {
        expect(response).to.be.instanceOf(BadRequest)
        expect(response.code).to.equal(400)
        expect(response.message).to.equal('nothing to upload')
      })

      it('does not call ipfs', () => {
        expect(stubs.addFile.callCount).to.equal(0)
      })

      it('does not update existing attachment', () => {
        expect(stubs.update.callCount).to.equal(0)
      })

      it('and does not call database insert method', () => {
        expect(stubs.insert.callCount).to.equal(0)
      })
    })

    describe('if database insert method fails', () => {
      beforeEach(async () => {
        stubs.insert.throwsException(new InternalServerError('this.db.insert() failure'))

        response = await controller.create({ body: { data: 'attachment-test' } } as any).catch((err) => err)
      })

      // QUESTION shall we rely on off-chain and do not assert here?
      // reset back to top level stubbing
      afterEach(() => {
        stubs.insert.callsFake((_, data: any) => [{ ...data, created_at: new Date(), id: 'attachment-insert-test' }])
      })

      it('throws InternalServerError error', () => {
        expect(stubs.insert.lastCall.args[0]).to.equal('attachment')
        expect(response).to.be.instanceOf(InternalServerError)
        expect(response.code).to.equal(500)
        expect(response.message).to.equal('this.db.insert() failure')
      })
    })

    describe('uploads a binary/Multer.File', () => {
      beforeEach(async () => {
        response = await controller.create(
          {} as any,
          { originalname: 'doc.txt', buffer: Buffer.alloc(1024, 0) } as Express.Multer.File
        )
      })

      it('uploads to ipfs and gets an ipfs hash', () => {
        expect(stubs.addFile.lastCall.args[0]).to.deep.contain({
          filename: 'doc.txt',
        })
      })

      it('does not update existing attachment', () => {
        expect(stubs.update.callCount).to.equal(0)
      })

      it('persists a new attachment', () => {
        expect(stubs.insert.lastCall.args[0]).to.equal('attachment')
        expect(stubs.insert.lastCall.args[1]).to.deep.contain({
          filename: 'doc.txt',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 1024,
        })
      })

      it('returns attachments', () => {
        expect(response).to.deep.contain({
          ...octetExample,
          id: 'attachment-insert-test',
        })
      })
    })

    describe('also uploads JSON from req.body', () => {
      beforeEach(async () => {
        response = await controller.create({ body: { data: 'attachment-test' } } as any)
      })

      it('uploads to ipfs and gets an ipfs hash', () => {
        expect(stubs.addFile.lastCall.args[0]).to.deep.contain({
          filename: 'json',
        })
      })

      it('does not update existing attachment', () => {
        expect(stubs.update.callCount).to.equal(0)
      })

      it('persists a new attachment', () => {
        expect(stubs.insert.lastCall.args[0]).to.equal('attachment')
        expect(stubs.insert.lastCall.args[1]).to.deep.contain({
          filename: 'json',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 26,
        })
      })

      it('returns attachments', () => {
        expect(response).to.deep.contain({
          filename: 'json',
          size: 26,
          id: 'attachment-insert-test',
        })
      })
    })
  })

  describe('getAll() - GET /', () => {
    beforeEach(async () => {
      stubs.get.resetHistory()
      stubs.get.callsFake(async () => [octetExample, jsonExample]), (response = await controller.getAll())
    })

    describe('if none found it', () => {
      beforeEach(async () => {
        stubs.get.callsFake(async () => [])
        response = await controller.getAll()
      })

      it('returns an empty array', () => {
        expect(response).to.be.empty
      })
    })

    it('returns all attachments from a local db', () => {
      expect(response.length).to.equal(2)
      expect(response).to.deep.include.members([
        {
          filename: 'doc.txt',
          size: 1024,
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          id: 'attachment-1-test',
          created_at: new Date('2020-10-10'),
        },
        {
          id: 'attachment-2-test',
          created_at: new Date('2024-01-05T09:39:29.785Z'),
          filename: 'json',
          ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
          size: 26,
        },
      ])
    })
  })

  describe('getById() - GET /{id}', () => {
    describe('if attachment does not exist', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.update.resetHistory()
        stubs.getFile.resetHistory()
        stubs.get.callsFake(async () => [])

        response = await controller
          .getById({ headers: { accept: 'application/octet-stream' } } as any, 'non-existant-id')
          .catch((err) => err)
      })

      it('throws not found error', () => {
        expect(response).to.be.instanceOf(NotFound)
        expect(response.code).to.equal(404)
        expect(response.message).to.equal('attachment not found')
      })

      it('does not attempt to retrieve file from ipfs', () => {
        expect(stubs.getFile.callCount).to.equal(0)
      })

      it('does not update current record', () => {
        expect(stubs.update.callCount).to.equal(0)
      })
    })

    describe('if accept header is octet-stream', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.callsFake(async () => [octetExample])

        response = await controller.getById({ headers: { accept: 'application/octet-stream' } } as any, 'octet-id')
      })

      it('retrieves file from ipfs', () => {
        expect(stubs.getFile.lastCall.args[0]).to.equal('QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn')
      })

      it('returns as octet', () => {
        expect(response).to.include.keys(['_readableState', '_read', '_events', '_eventsCount', '_maxListeners'])
      })
    })

    describe('if accept header is json', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.getFile.resetHistory()
        stubs.get.callsFake(async () => [
          {
            id: 'attachment-2-test',
            created_at: new Date('2024-01-05T09:39:29.785Z'),
            filename: 'json',
            ipfs_hash: 'QmXVStDC6kTpVHY1shgBQmyA4SuSrYnNRnHSak5iB6Eehn',
            size: 26,
          },
        ])
        stubs.getFile.callsFake(async () => ({
          blob: { arrayBuffer: () => JSON.stringify({ json: 'attachment' }), filename: 'json' },
        })),
          (response = await controller
            .getById({ headers: { accept: 'application/json' } } as any, 'attachment-id')
            .catch((err) => err))
      })

      it('returns parsed json', () => {
        expect(response).to.deep.contain({ json: 'attachment' })
      })
    })

    describe('if attachment does not have size or filename', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.getFile.resetHistory()
        stubs.get.callsFake(
          async () =>
            [
              {
                id: 'attachment-2-test',
                created_at: new Date('2024-01-05T09:39:29.785Z'),
                ipfs_hash: 'ipfs-hash-nulls',
                size: null,
                filename: null,
              },
            ] as AttachmentRow[]
        )

        response = await controller.getById({ headers: { accept: 'application/json' } } as any, 'json-id')
      })

      it('retrieves file from ipfs', () => {
        expect(stubs.getFile.lastCall.args[0]).to.equal('ipfs-hash-nulls')
      })

      it('updates local db with size and file name', () => {
        expect(stubs.update.lastCall.args[0]).to.equal('attachment')
        expect(stubs.update.lastCall.args[1]).to.deep.contain({ id: 'json-id' })
      })
    })
  })
})
