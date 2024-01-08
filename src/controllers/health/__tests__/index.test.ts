import { expect } from 'chai'

import Ipfs from '../../../lib/ipfs.js'
import Database from '../../../lib/db/index.js'
import Identity from '../../../lib/services/identity.js'
import ChainNode from '../../../lib/chainNode.js'
import { HealthController } from '../index.js'
import { Env } from '../../../env.js'
import { ServiceWatcher } from '../../../lib/service-watcher/index.js'
import { ServiceUnavailable } from '../../../lib/error-handler/index.js'

describe('/health', () => {
  let response: any
  let controller: HealthController

  const database: Database = new Database()
  const identity: Identity = new Identity(new Env())
  const node: ChainNode = new ChainNode(new Env(), database)
  const ipfs: Ipfs = new Ipfs(new Env())
  const watcher: ServiceWatcher = new ServiceWatcher(new Env(), node, identity, ipfs)

  before(() => {
    controller = new HealthController(watcher)
  })

  describe('get() - GET /', () => {
    beforeEach(async () => {
      response = await controller.get().catch((err) => err)
    })

    it('throws ServiceUnavailable error', () => {
      expect(response).to.be.instanceOf(ServiceUnavailable)
      expect(response.code).to.equal(503)
    })
  })
})
