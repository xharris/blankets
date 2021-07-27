import { useContext, createContext, useEffect, useCallback, useReducer, Reducer } from "react"
import { FC, ObjectAny } from "ts/ui"

interface IGlobalCtx<T> {
  data: T,
  set: (category:string, data:T) => void,
  update: (category:string, data:Partial<T>) => void,
  load: (data:Partial<T>) => void
}

type GlobalCtxAction = {
  type: "update" | "set" | "load",
  category?: string,
  data: ObjectAny | ((prev:ObjectAny) => any)
}

type ICreateCtx = () => [FC<React.Provider<IGlobalCtx<any>>>, IUseGlobalCtx]
type IUseGlobalCtx = <T>(category?:string, defaultValue?:T) => {
  all_data?: ObjectAny,
  data: T,
  set: (data:T) => void,
  update: (data:Partial<T>|((prev:T) => any)) => void,
  load: (data:Partial<T>) => void
}

export const createCtx: ICreateCtx = () => {
  const GlobalCtx = createContext<IGlobalCtx<any>>({
    data: {},
    set: () => {},
    update: () => {},
    load: () => {}
  })  
  
  const GlobalCtxProvider = (props:ObjectAny) => {
    const reducer: Reducer<ObjectAny, GlobalCtxAction> = (state, action) => {
      switch (action.type) {
        case "update":
          return { ...state, [action.category]:{  ...state[action.category], ...(
            typeof action.data === "function" ? action.data(state[action.category]) : action.data
          ) } }
        case "set":
          return { ...state, [action.category]:action.data }
        case "load":
          return action.data
        default:
          return state
      }
    }
    const [data, dispatch] = useReducer(reducer, {})
  
    return (
      <GlobalCtx.Provider {...props} value={{
        data,
        set: (category:string = "_any", new_data:any) => dispatch({ type:"set", category, data:new_data }),
        update: (category:string = "_any", new_data:any) => dispatch({ type:"update", category, data:new_data }),
        load: (new_data:any) => dispatch({ type:"load", data:new_data })
      }} />
    )
  }
  
  const useGlobalCtx: IUseGlobalCtx = (category, defaultValue) => {
    const {data, set:_set, update:_update, load:_load} = useContext(GlobalCtx)
  
    useEffect(() => {
      if (data && !data[category] && defaultValue) {
        _update(category, defaultValue)
        // console.log("updating",category,defaultValue)
      }
    }, [data, category, _update, defaultValue])
  
    const set = useCallback(new_data => _set(category, new_data), [category, _set])
    const update = useCallback(new_data => _update(category, new_data), [category, _update])
    const load = useCallback(new_data => _load({ ...defaultValue, ...new_data }), [_load])
  
    return {
      all_data: data,
      data: { ...defaultValue, ...data[category] },
      set,
      update,
      load
    }
  }

  return [ GlobalCtxProvider, useGlobalCtx ]
}

