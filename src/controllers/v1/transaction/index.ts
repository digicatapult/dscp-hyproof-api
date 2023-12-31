import { Controller, Get, Route, Path, Response, Tags, Security, Query } from 'tsoa'
import type { Logger } from 'pino'
import { injectable } from 'tsyringe'

import { logger } from '../../../lib/logger.js'
import Database from '../../../lib/db/index.js'
import type { DATE, UUID } from '../../../models/strings.js'
import { BadRequest, NotFound } from '../../../lib/error-handler/index.js'
import type {
  TransactionApiType,
  GetTransactionResponse,
  ListTransactionResponse,
  TransactionState,
} from '../../../models/transaction.js'

@injectable()
@Route('v1/transaction')
@Tags('transaction')
@Security('BearerAuth')
export class TransactionController extends Controller {
  log: Logger

  constructor(private db: Database) {
    super()
    this.log = logger.child({ controller: '/transaction' })
  }

  /**
   * Returns the details of all transactions.
   * @summary List transactions
   * @Query api_type lists all transactions by that type
   */
  @Response<BadRequest>(400, 'Request was invalid')
  @Response<NotFound>(404, 'Item not found')
  @Get('/')
  public async getAllTransactions(
    @Query() api_type?: TransactionApiType,
    @Query() state?: TransactionState,
    @Query() updated_since?: DATE
  ): Promise<ListTransactionResponse> {
    const where: { state?: TransactionState; api_type?: TransactionApiType; updated_since?: DATE } = {
      state,
      api_type,
      updated_since,
    }

    return this.db.get('transaction', where)
  }

  /**
   * @summary Get a transaction by ID
   * @param id The transactions's identifier
   */
  @Response<NotFound>(404, 'Item not found')
  @Get('{id}')
  public async getTransaction(@Path() id: UUID): Promise<GetTransactionResponse> {
    const transaction = await this.db.get('transaction', { id }).then((transactions) => transactions[0])

    return transaction
  }
}
