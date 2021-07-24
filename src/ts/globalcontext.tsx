import { createCtx } from "ts/context"

const [ GlobalCtxProvider, useGlobalCtx ] = createCtx()

export {
  GlobalCtxProvider,
  useGlobalCtx
}