import { useContext, createContext, useState, useEffect } from "react"
import { ObjectAny } from "ts/ui"

interface IGlobalCtx {
  data: ObjectAny,
  set: (category:string, data:ObjectAny) => void,
  update: (category:string, data:ObjectAny) => void
}

const GlobalCtx = createContext<IGlobalCtx | null>(null)

export const GlobalCtxProvier = (props:ObjectAny) => {
  const [data, setData] = useState<IGlobalCtx["data"]>({})

  return (
    <GlobalCtx.Provider {...props} value={{
      data,
      set: (category:string = "_any", new_data:any) => setData({...data, [category]:new_data}),
      update: (category:string = "_any", new_data:any) => setData({...data, [category]:{...data[category], ...new_data}}),
    }} />
  )
}

export const useGlobalCtx = (category?:string) => {
  const {data, set, update} = useContext(GlobalCtx)

  useEffect(() => {
    if (data && !data[category])
      set(category, {})
  }, [data, category])

  return {
    data: data[category] || {},
    set: (new_data:IGlobalCtx["data"]) => set(category, new_data),
    update: (new_data:IGlobalCtx["data"]) => update(category, new_data),
  }
}