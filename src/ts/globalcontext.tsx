import { createCtx } from "ts/context"

const [ GlobalCtxProvider, useGlobalCtx, GlobalCtx ] = createCtx()

export {
  GlobalCtxProvider,
  useGlobalCtx,
  GlobalCtx
}