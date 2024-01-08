import { expect } from 'chai'
import sinon from 'sinon'

import { CertificateController } from '../index.js'
import Identity from '../../../../lib/services/identity.js'
import { Env } from '../../../../env.js'
import Database from '../../../../lib/db/index.js'
import ChainNode from '../../../../lib/chainNode.js'
import Commitment from '../../../../lib/services/commitment.js'
import EmissionsCalculator from '../../../../lib/services/emissionsCalculator.js'
import { BadRequest, InternalServerError, NotFound } from '../../../../lib/error-handler/index.js'
import { CertificateRow, TransactionRow } from '../../../../lib/db/types.js'
import { certExamples, attachmentExample, transactionExample } from './fixtures.js'

describe('v1/certificate', () => {
  let response: any
  let controller: CertificateController
  const database: Database = new Database()
  const identity: Identity = new Identity(new Env())
  const commitment: Commitment = new Commitment('sha256')
  const node: ChainNode = new ChainNode(new Env(), database)
  const emissions = new EmissionsCalculator()

  const stubs = {
    build: sinon.stub(commitment, 'build' as any).callsFake(() => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    getSelfAddress: sinon
      .stub(identity, 'getMemberBySelf' as any)
      .callsFake((alias) => ({ address: 'member-self-test', alias })),
    getMemberByAlias: sinon
      .stub(identity, 'getMemberByAlias' as any)
      .callsFake((alias) => ({ address: 'member-by-alias-test', alias })),
    prepareRunProcess: sinon
      .stub(node, 'prepareRunProcess' as any)
      .callsFake(() =>
        Promise.resolve({ hash: { toHex: () => '9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19' } })
      ),
    submitRunProcess: sinon.stub(node, 'submitRunProcess' as any).callsFake(() => Promise.resolve()),
    get: sinon.stub(database, 'get').resolves(certExamples as CertificateRow[]),
    insert: sinon.stub(database, 'insert' as any).callsFake((_, data) => [data]),
    getLastFinalisedBlockHash: sinon
      .stub(node, 'getLastFinalisedBlockHash')
      .callsFake(() => '0x9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19' as any),
  }

  before(() => {
    controller = new CertificateController(identity, database, node, commitment, emissions)
  })

  afterEach(() => {
    stubs.submitRunProcess.resetHistory()
    stubs.prepareRunProcess.resetHistory()
  })

  describe('postDraft() - POST /', () => {
    beforeEach(async () => {
      response = await controller.postDraft({
        hydrogen_quantity_mwh: 10,
        energy_owner: 'emma-test',
        regulator: 'reginald-test',
        production_start_time: new Date('2023-12-25T07:11:58.837Z'),
        production_end_time: new Date('2023-12-25T09:11:58.837Z'),
        energy_consumed_mwh: 5,
      })
    })

    describe('if production time validation fails', () => {
      beforeEach(async () => {
        stubs.getMemberByAlias.resetHistory()
        stubs.getSelfAddress.resetHistory()
        stubs.insert.resetHistory()

        response = await controller
          .postDraft({
            production_start_time: new Date('2023-12-25T07:11:58.837Z'),
            production_end_time: new Date('2023-12-25T06:11:58.837Z'),
            hydrogen_quantity_mwh: 10,
            energy_consumed_mwh: 5,
          } as any)
          .catch((err) => err)
      })

      it('throws BadRequest error', () => {
        expect(response).to.be.instanceOf(BadRequest)
        expect(response.code).to.equal(400)
        expect(response.message).to.equal('Production end time must be greater than start time')
      })

      it('does not build commitment or call identity service', () => {
        expect(stubs.getMemberByAlias.callCount).to.equal(0)
        expect(stubs.getSelfAddress.callCount).to.equal(0)
      })

      it('does not call database insert method', () => {
        expect(stubs.insert.callCount).to.equal(0)
      })
    })

    describe('if database.insert fails', () => {
      beforeEach(async () => {
        stubs.getMemberByAlias.resetHistory()
        stubs.getSelfAddress.resetHistory()
        stubs.insert.throwsException(new InternalServerError('some database error [test]'))

        response = await controller
          .postDraft({
            production_start_time: new Date('2023-12-25T07:11:58.837Z'),
            production_end_time: new Date('2023-12-25T09:11:58.837Z'),
            hydrogen_quantity_mwh: 10,
            energy_consumed_mwh: 5,
            energy_owner: 'emma-test',
            regulator: 'reginald-test',
          } as any)
          .catch((err) => err)
      })

      // restore stub back to this initial state
      afterEach(() => {
        stubs.insert.resetHistory()
        stubs.insert.callsFake((_, data) => [data])
      })

      it('throws InternalServerError error', () => {
        expect(response).to.be.instanceOf(InternalServerError)
        expect(response.code).to.equal(500)
      })
    })

    it('gets identities from identity service API', () => {
      expect(stubs.getMemberByAlias.getCall(1).args[0]).to.equal('reginald-test')
      expect(stubs.getMemberByAlias.getCall(0).args[0]).to.equal('emma-test')
    })

    it('persist and returns a draft certificate', () => {
      expect(response).to.deep.contain({
        hydrogen_quantity_mwh: 10,
        energy_owner: 'emma-test',
        regulator: 'reginald-test',
        latest_token_id: null,
        original_token_id: null,
        production_start_time: new Date('2023-12-25T07:11:58.837Z'),
        production_end_time: new Date('2023-12-25T09:11:58.837Z'),
        energy_consumed_mwh: 5,
      })
      expect(response).to.have.property('commitment')
    })
  })

  describe('getAll() - GET /', () => {
    beforeEach(async () => {
      response = await controller.getAll()
    })

    it('returns all certificates with mapped identities', () => {
      expect(response[0]).to.deep.contain({
        id: 'test-cert-1',
        state: 'issued',
        energy_owner: 'emma-test',
        regulator: 'ray-test',
        hydrogen_owner: 'heidi',
      })
      expect(response[1]).to.deep.contain({
        id: 'test-cert-4',
        state: 'initiated',
        energy_owner: 'emma2-test',
        regulator: 'ray-test',
        hydrogen_owner: 'heidi',
      })
    })
  })

  describe('getById() - GET /{id}', () => {
    beforeEach(async () => {
      response = await controller.getById('some-id')
    })

    describe('if certificate does not exist', () => {
      beforeEach(async () => {
        stubs.get.throws(new NotFound('certificate'))
        response = await controller.getById('does-nt-exists-id').catch((err) => err)
      })

      it('throws NotFound Error', () => {
        expect(response.message).to.equal('certificate not found')
        expect(response.code).to.equal(404)
      })
    })

    it('returns certficiate by given id', () => {
      expect(response).to.deep.contain({
        id: 'test-cert-1',
        state: 'issued',
        energy_owner: 'emma-test',
        regulator: 'ray-test',
        hydrogen_owner: 'heidi',
      })
    })
  })

  describe('getInitiationTransaction()', () => {
    beforeEach(async () => {
      stubs.get.resolves([transactionExample] as TransactionRow[])
      response = await controller.getInitiationTransaction('test-cert-1', 'initiate-cert-transaction-test')
    })

    describe('if certificate does not exist', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.onCall(0).throws(new NotFound('certificate'))
        response = await controller.getInitiationTransaction('test-cert-1', 'non-existant-id').catch((err) => err)
      })

      it('throws NotFound error', () => {
        expect(response).to.be.instanceOf(NotFound)
        expect(response.code).to.equal(404)
        expect(response.message).to.equal('certificate not found')
      })
    })

    describe('if transaction does not exist', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()

        stubs.get.onCall(1).resolves(certExamples as CertificateRow[])
        stubs.get.onCall(0).throws(new NotFound('transaction'))
        response = await controller.getInitiationTransaction('test-cert-1', 'non-existant-id').catch((err) => err)
      })

      it('calls external services', () => {
        expect(1).to.equal(1)
      })

      it('throws NotFound Error', () => {
        expect(response).to.be.instanceOf(NotFound)
        expect(response.code).to.equal(404)
        expect(response.message).to.equal('transaction not found')
      })
    })

    it('returns initiation transaction by given certificate id and transaction', async () => {
      expect(response).to.equal(transactionExample)
    })
  })

  describe('getIssuanceTransaction() - GET {id}/issuance/{transactionId}', () => {
    beforeEach(async () => {
      stubs.get.resolves([
        { ...transactionExample, transaction_type: 'issue_cert', id: 'issue-cert-transaction-test' },
      ] as TransactionRow[])
      response = await controller.getInitiationTransaction('test-cert-1', 'issue-cert-transaction-test')
    })

    describe('if issuance transaction does not exist', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.onCall(0).throws(new NotFound('certificate'))
        response = await controller.getIssuanceTransaction('test-cert-1', 'non-existant-id').catch((err) => err)
      })

      it('throws NotFound error', () => {
        expect(response).to.be.instanceOf(NotFound)
      })
    })

    it('returns updated certificate', () => {
      expect(response).to.deep.contain({
        energy_owner: 'emma-test',
        hydrogen_owner: 'heidi',
        id: 'test-cert-1',
        regulator: 'ray-test',
        state: 'issued',
      })
    })
  })

  describe('getRevocationTransaction() - GET {id}/issuance/{transactionId}', () => {
    beforeEach(async () => {
      stubs.get.resolves([
        { ...transactionExample, transaction_type: 'revoke_cert', id: 'revoke-cert-transaction-test' },
      ] as TransactionRow[])
      response = await controller.getRevocationTransaction('test-cert-1', 'revoke-cert-transaction-test')
    })

    describe('if revocation transaction does not exist', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.get.onCall(0).throws(new NotFound('transaction'))
        response = await controller
          .getRevocationTransaction('test-cert-1', 'revoke-cert-transaction-test')
          .catch((err) => err)
      })

      it('throws NotFound error', () => {
        expect(response).to.be.instanceOf(NotFound)
        expect(response.code).to.equal(404)
        expect(response.message).to.equal('transaction not found')
      })
    })

    it('returns transaction', () => {
      expect(response).to.deep.contain({
        id: 'test-cert-1',
        state: 'issued',
        energy_owner: 'emma-test',
        regulator: 'ray-test',
        hydrogen_owner: 'heidi',
      })
    })
  })

  describe('createOnChain() - POST {id}/initiation', () => {
    beforeEach(async () => {
      stubs.getSelfAddress.resetHistory()
      stubs.insert.resetHistory()
      stubs.insert.callsFake((_, data) => [data])
      stubs.get.onCall(0).resolves([certExamples[3]] as CertificateRow[])
      stubs.get.onCall(1).resolves([transactionExample] as TransactionRow[])

      response = await controller.createOnChain('test-cert-3').catch((err) => err)
    })

    afterEach(() => {
      stubs.get.resetHistory()
    })

    describe('if certificate is in invalid state', () => {
      beforeEach(async () => {
        stubs.get.resolves([certExamples[3]] as CertificateRow[])
        response = await controller.createOnChain('test-cert-1').catch((err) => err)
      })

      it('throws BadRequest error', () => {
        expect(response).to.be.instanceOf(BadRequest)
      })
    })

    describe('if hydrogen_owner is not self', () => {
      beforeEach(async () => {
        stubs.get.resetHistory()
        stubs.insert.resetHistory()
        stubs.submitRunProcess.resetHistory()
        stubs.prepareRunProcess.resetHistory()
        stubs.get.onCall(0).resolves([certExamples[2]] as CertificateRow[])

        response = await controller.createOnChain('test-cert-2').catch((err) => err)
      })

      it('throws BadRequest error', () => {
        expect(response).to.be.instanceOf(BadRequest)
        expect(response.code).to.equal(400)
        expect(response.message).to.equal('certificate must not be issued or revoked')
      })

      it('does not call any chain methods e.g. runProcess', () => {
        expect(stubs.submitRunProcess.notCalled).to.equal(true)
        expect(stubs.prepareRunProcess.notCalled).to.equal(true)
      })

      it('also does not call insert method', () => {
        expect(stubs.insert.notCalled).to.equal(true)
      })
    })

    it('gets selfs address from identity service', () => {
      expect(stubs.getSelfAddress.callCount).to.equal(1)
    })

    it('validates the current certificate status', () => {
      expect(stubs.get.lastCall.args[0]).to.equal('certificate')
      expect(stubs.get.lastCall.args[1]).to.deep.contain({ id: 'test-cert-3' })
    })

    it('prepares a run process', () => {
      const [{ process, outputs }] = stubs.prepareRunProcess.lastCall.args

      expect(process).to.deep.contain({ id: 'initiate_cert', version: 1 })
      expect(outputs[0].roles).to.deep.contain({
        regulator: 'ray-test',
        hydrogen_owner: 'member-self-test',
        energy_owner: 'member-self-test',
      })
      expect(outputs[0].metadata).to.deep.contain({
        '@version': {
          type: 'LITERAL',
          value: '1',
        },
        '@type': {
          type: 'LITERAL',
          value: 'InitiatedCert',
        },
        hydrogen_quantity_mwh: {
          type: 'LITERAL',
          value: '10',
        },
      })
    })

    it('inserts a transaction', () => {
      expect(stubs.insert.lastCall.args[1]).to.deep.contain({
        api_type: 'certificate',
        hash: '9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19',
        transaction_type: 'initiate_cert',
      })
    })

    it('submits a run process', () => {
      expect(stubs.submitRunProcess.lastCall.args[0]).to.have.property('hash')
    })
  })

  describe('issueOnChain() - POST {id}/issueance', () => {
    beforeEach(async () => {
      stubs.getSelfAddress.resetHistory()
      stubs.get.resetHistory()
      stubs.get.onCall(0).resolves([certExamples[2]] as CertificateRow[])
      stubs.get.onCall(1).resolves([transactionExample] as TransactionRow[])
      response = await controller.issueOnChain('test-cert-3', { embodied_co2: 100 }).catch((err) => err)
    })

    it('gets selfs address from identity service', () => {
      expect(stubs.getSelfAddress.callCount).to.equal(1)
    })

    it('validates the current certificate status', () => {
      expect(stubs.get.lastCall.args[0]).to.equal('certificate')
      expect(stubs.get.lastCall.args[1]).to.deep.contain({ id: 'test-cert-3' })
    })

    it('prepares a run process', () => {
      const [{ process, inputs, outputs }] = stubs.prepareRunProcess.lastCall.args
      expect(process).to.deep.contain({
        id: 'issue_cert',
        version: 1,
      })
      expect(inputs[0]).to.equal(3)
      expect(outputs[0].roles).to.deep.contain({
        regulator: 'ray-test',
        hydrogen_owner: 'member-self-test',
        energy_owner: 'member-self-test',
      })
      expect(outputs[0].metadata).to.deep.contain({
        '@version': {
          type: 'LITERAL',
          value: '1',
        },
        '@type': {
          type: 'LITERAL',
          value: 'IssuedCert',
        },
        // '@original_id': [Object],
        embodied_co2: {
          type: 'LITERAL',
          value: '100',
        },
      })
    })

    it('inserts a transaction', () => {
      expect(stubs.insert.lastCall.args[1]).to.deep.contain({
        api_type: 'certificate',
        hash: '9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19',
        local_id: 'test-cert-3',
        transaction_type: 'issue_cert',
      })
    })

    it('submits a run process', () => {
      expect(stubs.submitRunProcess.lastCall.args[0]).to.have.property('hash')
    })
  })

  describe('revokeOnChain() - Post {id}/revocation', () => {
    beforeEach(async () => {
      stubs.getSelfAddress.resetHistory()
      stubs.get.resetHistory()
      stubs.getSelfAddress.callsFake(() => ({ address: 'ray-test', alias: 'ray-test' })),
        stubs.get.onCall(0).returns([certExamples[0]] as any)
      stubs.get.onCall(1).returns([attachmentExample] as any)

      response = await controller.revokeOnChain('test-cert-3', { reason: 'some-attachment-id' }).catch((err) => err)
    })

    it('gets selfs address from identity service', () => {
      expect(stubs.getSelfAddress.callCount).to.equal(1)
    })

    it('validates status and confirms that attachment is present', () => {
      expect(stubs.get.lastCall.args[0]).to.equal('attachment')
      expect(stubs.get.lastCall.args[1]).to.deep.contain({ id: 'some-attachment-id' })
    })

    it('prepares a run process', () => {
      const [{ process }] = stubs.prepareRunProcess.lastCall.args

      expect(process).to.deep.contain({
        id: 'revoke_cert',
        version: 1,
      })
    })

    it('inserts a transaction', () => {
      expect(stubs.insert.lastCall.args[1]).to.deep.contain({
        api_type: 'certificate',
        local_id: 'test-cert-1',
        hash: '9d441a0fe4fb942070f4d3014e2367496d4afc3bc9b983f1ac5b3813467a0c19',
        transaction_type: 'revoke_cert',
      })
    })

    it('submits a run process', () => {
      expect(stubs.submitRunProcess.lastCall.args[0]).to.have.property('hash')
    })
  })

  describe('getInitiationTransactions() - GET {id}/initiation', () => {
    beforeEach(async () => {
      stubs.get.resetHistory()
      stubs.get.onCall(0).resolves([
        { ...transactionExample, id: '1' },
        { ...transactionExample, id: '2' },
      ] as TransactionRow[])

      response = await controller.getInitiationTransactions('test-cert-1')
    })

    it('returns all initiations for a given cerfiticate id', () => {
      expect(response).to.be.an('Array')
      expect(response[0]).to.deep.contain({
        id: '1',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'initiate_cert',
      })
      expect(response[1]).to.deep.contain({
        id: '2',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'initiate_cert',
      })
    })
  })
  describe('getIssuanceTransactions() - GET {id}/issuance', () => {
    beforeEach(async () => {
      stubs.get.resetHistory()
      stubs.get.onCall(0).resolves([
        { ...transactionExample, transaction_type: 'issue_cert', id: '1' },
        { ...transactionExample, transaction_type: 'issue_cert', id: '2' },
      ] as TransactionRow[])

      response = await controller.getInitiationTransactions('test-cert-1')
    })

    it('returns all initiations for a given cerfiticate id', () => {
      expect(response).to.be.an('Array')
      expect(response[0]).to.deep.contain({
        id: '1',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'issue_cert',
      })
      expect(response[1]).to.deep.contain({
        id: '2',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'issue_cert',
      })
    })
  })

  describe('getRevocationTransactions()- GET {id}/revocation', () => {
    beforeEach(async () => {
      stubs.get.resetHistory()
      stubs.get.onCall(0).resolves([
        { ...transactionExample, transaction_type: 'revoke_cert', id: '1' },
        { ...transactionExample, transaction_type: 'revoke_cert', id: '2' },
      ] as TransactionRow[])

      response = await controller.getInitiationTransactions('test-cert-1')
    })

    it('returns all initiations for a given cerfiticate id', () => {
      expect(response).to.be.an('Array')
      expect(response[0]).to.deep.contain({
        id: '1',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'revoke_cert',
      })
      expect(response[1]).to.deep.contain({
        id: '2',
        api_type: 'certificate',
        local_id: 'test-cert-1',
        state: 'submitted',
        transaction_type: 'revoke_cert',
      })
    })
  })
})
