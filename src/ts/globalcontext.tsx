import { useContext, createContext, useState, useEffect } from "react"
import { ObjectAny } from "ts/ui"

interface IGlobalCtx<T> {
  data: T,
  set: (category:string, data:T) => void,
  update: (category:string, data:Partial<T>) => void
}

interface IUseGlobalCtx<T> {
  data: T,
  set: (data:T) => void,
  update: (data:Partial<T>) => void
}

const GlobalCtx = createContext<IGlobalCtx<any>>({
  data: {},
  set: () => {},
  update: () => {}
})

export const GlobalCtxProvider = (props:ObjectAny) => {
  const [data, setData] = useState<ObjectAny>({})

  return (
    <GlobalCtx.Provider {...props} value={{
      data,
      set: (category:string = "_any", new_data:any) => setData({...data, [category]:new_data}),
      update: (category:string = "_any", new_data:any) => setData({...data, [category]:{...data[category], ...new_data}}),
    }} />
  )
}

export const useGlobalCtx = <T, >(category?:string): IUseGlobalCtx<T> => {
  const {data, set, update} = useContext(GlobalCtx)

  useEffect(() => {
    if (data && !data[category])
      set(category, {})
  }, [data, category])

  return {
    data: data[category] ?? {},
    set: (new_data) => set(category, new_data),
    update: (new_data) => update(category, new_data),
  } 
}