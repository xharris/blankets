import { useCallback } from "react"
import { ObjectAny, useEvent } from "ts/ui"
import { useGlobalCtx  } from "ts/globalcontext"

type UndoOptions = {
  size?:number,
  shortcuts?:boolean
}

type IUseUndo = <T>(data:ObjectAny, load:(newdata:Partial<T>) => void, options:UndoOptions) => {
  saveHistory:()=>void,
  resetHistory:()=>void
}

export const useUndo:IUseUndo = (data, load, options) => {
  const { size=10, shortcuts=true } = options
  const { data:{ past, future }, update:update } = useGlobalCtx("history", {
    past: [],
    future: []
  })

  const saveHistory = useCallback(() => {
    update({
      past: [
        ...(past.length > size ? past.splice(0,1) : past), 
        { ...data }
      ],
      future: []
    })
  }, [past, update, size, data])

  const resetHistory = useCallback(() => {
    update({
      past: [],
      future: []
    })
  }, [update])

  useEvent("keydown", (e:KeyboardEvent) => {
    if (!shortcuts) return 

    const key = e.key.toLowerCase()
    // undo
    if (e.ctrlKey && key === 'z' && past.length > 0) {
      load(past[past.length - 1])
      update({ 
        past: past.splice(0, past.length - 1),
        future: [ ...future, { ...data } ]
      })
    }
    // redo
    if (e.ctrlKey && (key === 'y' || (e.shiftKey && key === 'z')) && future.length > 0) {
      load(future[future.length - 1])
      update({ 
        past: [ 
          ...(past.length > size ? past.splice(0,1) : past), 
          { ...data }
        ],
        future: future.splice(0, future.length - 1)
      })
    }
  }, [past, future, update, data, load, size, shortcuts])

  return { saveHistory, resetHistory }
}