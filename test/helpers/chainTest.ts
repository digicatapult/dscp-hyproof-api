import { before, after } from 'mocha'
import { Express } from 'express'
import { container } from 'tsyringe'

import createHttpServer from '../../src/server'
import Indexer from '../../src/lib/indexer'

import { CertificateRow } from '../../src/lib/db/types'
import Database from '../../src/lib/db'
import ChainNode from '../../src/lib/chainNode'
import { logger } from '../../src/lib/logger'
import { put } from './routeHelper'
import { mockEnv, notSelfAddress, regulatorAddress, selfAddress } from './mock'
import { processInitiateCert, processIssueCert } from '../../src/lib/payload'
import { SubmittableExtrinsic } from '@polkadot/api/types'
import { SubmittableResult } from '@polkadot/api'

const db = new Database()

const submitRunProcessExtrinsicAndSeal = async (
  node: ChainNode,
  extrinsic: SubmittableExtrinsic<'promise', SubmittableResult>
): Promise<number[]> => {
  return new Promise<number[]>((resolve, reject) => {
    node
      .submitRunProcess(extrinsic, (state, outputs) => {
        if (state === 'finalised') {
          setTimeout(() => resolve(outputs ? outputs : []), 100)
        } else if (state === 'failed') reject()
      })
      .then(() => {
        node.sealBlock()
      })
  })
}

export const withAppAndIndexer = (context: { app: Express; indexer: Indexer }) => {
  before(async function () {
    context.app = await createHttpServer()
    const node = container.resolve(ChainNode)

    const blockHash = await node.getLastFinalisedBlockHash()
    const blockHeader = await node.getHeader(blockHash)
    await db
      .insert('processed_blocks', {
        hash: blockHash,
        height: blockHeader.height,
        parent: blockHash,
      })
      .catch(() => {
        // intentional ignorance of errors
      })

    context.indexer = new Indexer({ db: new Database(), logger, node })
    await context.indexer.start()
    context.indexer.processAllBlocks(await node.getLastFinalisedBlockHash()).then(() =>
      node.watchFinalisedBlocks(async (hash) => {
        await context.indexer.processAllBlocks(hash)
      })
    )
  })

  after(async function () {
    await context.indexer.close()
  })
}

export const withInitialisedCertFromNotSelf = async (context: { app: Express; db: Database; cert: CertificateRow }) => {
  const node = new ChainNode(
    mockEnv({
      USER_URI: '//Bob',
    }),
    db
  )

  const extrinsic = await node.prepareRunProcess(
    processInitiateCert({
      hydrogen_owner: notSelfAddress,
      energy_owner: selfAddress,
      regulator: regulatorAddress,
      hydrogen_quantity_mwh: 1,
      commitment: 'ffb693f99a5aca369539a90b6978d0eb',
    } as CertificateRow)
  )

  const [tokenId] = await submitRunProcessExtrinsicAndSeal(node, extrinsic)

  const [{ id }] = await db.get('certificate', { latest_token_id: tokenId })

  const { status, body } = await put(context.app, `/v1/certificate/${id}`, {
    production_start_time: new Date('2023-12-01T00:00:00.000Z'),
    production_end_time: new Date('2023-12-02T00:00:00.000Z'),
    energy_consumed_mwh: 2,
    commitment_salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  })

  if (status != 200) {
    throw new Error(`Failed to add commitment information to certificate: ${JSON.stringify(body)}`)
  }

  const [cert] = await db.get('certificate', { id })
  context.cert = cert
}

export const withIssuedCertAsRegulator = async (context: { app: Express; db: Database; cert: CertificateRow }) => {
  const heidiNode = new ChainNode(
    mockEnv({
      USER_URI: '//Bob',
    }),
    db
  )

  const initExtrinsic = await heidiNode.prepareRunProcess(
    processInitiateCert({
      hydrogen_owner: notSelfAddress,
      energy_owner: regulatorAddress,
      regulator: selfAddress,
      hydrogen_quantity_mwh: 1,
      commitment: 'ffb693f99a5aca369539a90b6978d0eb',
    } as CertificateRow)
  )

  const [initTokenId] = await submitRunProcessExtrinsicAndSeal(heidiNode, initExtrinsic)

  const emmaNode = new ChainNode(
    mockEnv({
      USER_URI: '//Charlie',
    }),
    db
  )

  const issueExtrinsic = await emmaNode.prepareRunProcess(
    processIssueCert({
      latest_token_id: initTokenId,
      hydrogen_owner: notSelfAddress,
      energy_owner: regulatorAddress,
      regulator: selfAddress,
      original_token_id: initTokenId,
      embodied_co2: 42,
    } as CertificateRow)
  )

  const [issuedTokenId] = await submitRunProcessExtrinsicAndSeal(emmaNode, issueExtrinsic)
  const [cert] = await db.get('certificate', { latest_token_id: issuedTokenId })
  context.cert = cert
}
