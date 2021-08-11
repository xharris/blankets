import { createCtx } from "ts/context"

const [ SaveCtxProvider, useSaveCtx, SaveCtx ] = createCtx()

export {
  SaveCtxProvider,
  useSaveCtx,
  SaveCtx
}