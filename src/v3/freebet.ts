import {
  FreeBetv3Contract_NewBet_loader,
  FreeBetv3Contract_NewBet_handler,
  FreeBetv3Contract_BettorWin_loader,
  FreeBetv3Contract_BettorWin_handler,
  FreeBetv3Contract_PayoutsResolved_loader,
  FreeBetv3Contract_PayoutsResolved_handler,
  FreeBetv3Contract_BettorWin_handlerAsync,
  FreeBetv3Contract_NewBet_handlerAsync,
} from "../../generated/src/Handlers.gen";
import { linkBetWithFreeBet } from "../common/bets";
import { createFreebet, resolveFreebet, withdrawFreebet } from "../common/freebets";
import { VERSION_V3 } from "../constants";
import { getEntityId } from "../utils/schema";

FreeBetv3Contract_NewBet_loader(({ event, context }) => {
  context.CoreContract.load(event.params.core.toLowerCase(), {});
 });
FreeBetv3Contract_NewBet_handlerAsync(async ({ event, context }) => {
  const coreContractEntity = await context.CoreContract.get(event.params.core.toLowerCase())

  if (!coreContractEntity) {
    context.log.error('v3 handleNewBet (freebet) coreContractEntity not found. coreContractEntityId = ${event.params.core}')
    return
  }

  const freebetContractEntity = (await context.FreebetContract.get(event.srcAddress))!
  const liquidityPoolContractEntity = (await context.LiquidityPoolContract.get(freebetContractEntity.liquidityPool_id))!

  const freebetEntity = createFreebet(
    VERSION_V3,
    freebetContractEntity.id,
    event.srcAddress,
    freebetContractEntity.name,
    freebetContractEntity.affiliate,
    event.params.freeBetId,
    event.params.bettor,
    event.params.amount,
    liquidityPoolContractEntity.tokenDecimals,
    event.params.minOdds,
    BigInt(event.blockTimestamp) - event.params.expiresAt,
    event.transactionHash,
    coreContractEntity.id,
    event.params.azuroBetId,
    BigInt(event.blockNumber),
    context,
  )

  await linkBetWithFreeBet(
    coreContractEntity.id,
    event.params.azuroBetId,
    freebetEntity.id,
    freebetEntity.owner,
    event.blockTimestamp,
    context,
  )
});

FreeBetv3Contract_BettorWin_loader(({ event, context }) => { 
  context.CoreContract.load(event.params.core.toLowerCase(), {});
});
FreeBetv3Contract_BettorWin_handlerAsync(async ({ event, context }) => {
  const coreContractEntity = context.CoreContract.get(event.params.core.toLowerCase())

  if (!coreContractEntity) {
    context.log.error('v3 handleBettorWin coreContractEntity not found. coreContractEntityId = {event.params.core}')

    return
  }

  const freebetEntityId = getEntityId(event.srcAddress, event.params.freeBetId.toString())
  const freebetEntity = context.Freebet.get(freebetEntityId)

  // TODO remove later
  if (!freebetEntity) {
    context.log.error(`v3 handleBettorWin freebetEntity not found. freebetEntityId = ${freebetEntityId}`)
    return
  }

  await withdrawFreebet(freebetEntityId, event.blockTimestamp, context)
});

FreeBetv3Contract_PayoutsResolved_loader(({ event, context }) => { });
FreeBetv3Contract_PayoutsResolved_handler(({ event, context }) => {
  for (let i = 0; i < event.params.azuroBetId.length; i++) {
    resolveFreebet(
      event.srcAddress,
      event.params.azuroBetId[i],
      false,
      event.blockTimestamp,
      context
    )
  }
});
