import { createCtx } from "ts/context"

const [ SaveCtxProvider, useSaveCtx ] = createCtx()

export {
  SaveCtxProvider,
  useSaveCtx
}